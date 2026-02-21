import asyncio
from getpass import getpass
import json
import logging
import os
from pathlib import Path
import sys
from typing import Any, Dict, FrozenSet, Literal, NamedTuple, Optional, Set, Union

from omemo.storage import Just, Maybe, Nothing, Storage
from omemo.types import DeviceInformation, JSONType

from slixmpp.clientxmpp import ClientXMPP
from slixmpp.jid import JID  # pylint: disable=no-name-in-module
from slixmpp.plugins import register_plugin  # type: ignore[attr-defined]
from slixmpp.plugins.xep_0045 import XEP_0045  # type: ignore[attr-defined]
from slixmpp.stanza import Message
from slixmpp.xmlstream.handler import CoroutineCallback
from slixmpp.xmlstream.matcher import MatchXPath

from slixmpp_omemo import TrustLevel, XEP_0384
from websockets.asyncio.client import connect
from dotenv import load_dotenv 

load_dotenv()

log = logging.getLogger(__name__)
class StorageImpl(Storage):
    def __init__(self, json_file_path: Path) -> None:
        super().__init__()

        self.__json_file_path = json_file_path
        self.__data: Dict[str, JSONType] = {}
        try:
            with open(self.__json_file_path, encoding="utf8") as f:
                self.__data = json.load(f)
        except Exception:  # pylint: disable=broad-exception-caught
            pass

    async def _load(self, key: str) -> Maybe[JSONType]:
        if key in self.__data:
            return Just(self.__data[key])

        return Nothing()

    async def _store(self, key: str, value: JSONType) -> None:
        self.__data[key] = value
        with open(self.__json_file_path, "w", encoding="utf8") as f:
            json.dump(self.__data, f)

    async def _delete(self, key: str) -> None:
        self.__data.pop(key, None)
        with open(self.__json_file_path, "w", encoding="utf8") as f:
            json.dump(self.__data, f)


class PluginCouldNotLoad(Exception):
    pass

class XEP_0384Impl(XEP_0384):  # pylint: disable=invalid-name
    default_config = {
        "fallback_message": "This message is OMEMO encrypted.",
        "json_file_path": None
    }

    def __init__(self, *args: Any, **kwargs: Any) -> None:
        super().__init__(*args, **kwargs)
        self.__storage: Storage

    def plugin_init(self) -> None:
        if not self.json_file_path:
            raise PluginCouldNotLoad("JSON file path not specified.")
        self.__storage = StorageImpl(Path(self.json_file_path))
        super().plugin_init()

    @property
    def storage(self) -> Storage:
        return self.__storage

    @property
    def _btbv_enabled(self) -> bool:
        return True

    async def _devices_blindly_trusted(
        self,
        blindly_trusted: FrozenSet[DeviceInformation],
        identifier: Optional[str]
    ) -> None:
        log.info(f"[{identifier}] Devices trusted blindly: {blindly_trusted}")

    async def _prompt_manual_trust(
        self,
        manually_trusted: FrozenSet[DeviceInformation],
        identifier: Optional[str]
    ) -> None:
        session_mananger = await self.get_session_manager()

        for device in manually_trusted:
                await session_mananger.set_trust(
                    device.bare_jid,
                    device.identity_key,
                    TrustLevel.TRUSTED.value
                )


register_plugin(XEP_0384Impl)


class OmemoEchoClient(ClientXMPP):
    def __init__(self, jid: str, password: str, room_jid: str = None, nick: str = None) -> None:
        super().__init__(jid, password)

        self.room_jid = room_jid
        self.nick = nick
        # Queues for communicating with the websocket task
        self.ws_send_queue: Optional[asyncio.Queue] = None
        self.ws_recv_queue: Optional[asyncio.Queue] = None

        self.add_event_handler("session_start", self.start)
        self.register_handler(CoroutineCallback(
            "Messages",
            MatchXPath(f"{{{self.default_ns}}}message"),
            self.message_handler
        ))

    async def start(self, _event: Any) -> None:
        self.send_presence()
        await self.get_roster()  # type: ignore[no-untyped-call]

        xep_0045: Optional[XEP_0045] = self["xep_0045"]
        if xep_0045 is not None and self.room_jid is not None and self.nick is not None:
            # Started as a task as a workaround for https://codeberg.org/poezio/slixmpp/issues/3660
            asyncio.create_task(xep_0045.join_muc_wait(self.room_jid, self.nick))

    async def message_handler(self, stanza: Message) -> None:
        xep_0045: Optional[XEP_0045] = self["xep_0045"]
        xep_0384: XEP_0384 = self["xep_0384"]

        mfrom: JID = stanza["from"]
        mtype = stanza["type"]
        if mtype not in { "chat", "normal", "groupchat" }:
            return
        is_muc_reflection = False
        if mtype == "groupchat":
            if xep_0045 is None:
                log.warning("Ignoring MUC message while MUC plugin is not loaded.")
                return

            mfrom_nick = mfrom.resource
            mfrom = JID(mfrom.bare)

            real_mfrom_str: Optional[str] = xep_0045.get_jid_property(JID(mfrom.bare), mfrom_nick, "jid")
            if real_mfrom_str is None:
                return

            if JID(real_mfrom_str) == self.boundjid:
                is_muc_reflection = True

        namespace = xep_0384.is_encrypted(stanza)
        if namespace is None:
            if not stanza["body"]:
                return
            if is_muc_reflection:
                log.debug(f"Ignoring reflected unencrypted MUC message: {stanza['body']}")
                return
            # await self.send_message(mfrom, mtype, stanza['body'], False)
            return

        try:
            message, device_information = await xep_0384.decrypt_message(stanza)
            if not message["body"]:
                return
            if is_muc_reflection:
                log.info(f"Ignoring reflected encrypted MUC message: {message['body']}")
                return
            # Send decrypted message to websocket task if available
            payload = {
                "type": "xmpp_message",
                "id": stanza["id"],
                "body": message["body"],
            }
            send_q = getattr(self, "ws_send_queue", None)
            if send_q is not None:
                try:
                    await send_q.put(payload)
                except Exception:
                    log.exception("Failed to enqueue message to websocket send queue")
            return
        except Exception as e:  # pylint: disable=broad-exception-caught
            print(e)    
    


async def websocket_connect(send_queue: asyncio.Queue, recv_queue: asyncio.Queue) -> None:
    while True:
        recv_task = None
        try:
            await asyncio.sleep(10)
            async with connect("ws://localhost:8080") as ws:
                print('Connected to ws://localhost:8080')
                # log.info("Connected to ws://localhost:8080")

                async def recv_loop() -> None:
                    async for message in ws:
                        try:
                            await recv_queue.put(message)
                        except Exception:
                            log.exception("Failed to queue received websocket message")

                recv_task = asyncio.create_task(recv_loop())

                # send loop
                while True:
                    payload = await send_queue.get()
                    try:
                        await ws.send(json.dumps(payload))
                    except Exception:
                        log.exception("Failed to send websocket message")
                        raise
        except Exception:
            log.exception("WebSocket error, reconnecting in 5s")
            await asyncio.sleep(5)
        finally:
            if recv_task is not None:
                recv_task.cancel()
                try:
                    await recv_task
                except Exception:
                    pass


def main() -> None:
    # create and set a fresh event loop for this thread
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)

    # create queues and start websocket task
    send_q: asyncio.Queue = asyncio.Queue()
    recv_q: asyncio.Queue = asyncio.Queue()
    loop.create_task(websocket_connect(send_q, recv_q))

    xmpp = OmemoEchoClient(os.environ["XMPP_USER"], os.environ["XMPP_PASSWORD"], room_jid=JID(os.environ["XMPP_ROOM"]), nick="fmbot")
    # attach queues to xmpp client so handlers can use them
    xmpp.ws_send_queue = send_q
    xmpp.ws_recv_queue = recv_q
    xmpp.register_plugin("xep_0045")  # Multi-User Chat
    xmpp.register_plugin("xep_0199")  # XMPP Ping
    xmpp.register_plugin("xep_0380")  # Explicit Message Encryption
    xmpp.register_plugin("xep_0384", { "json_file_path": "../omemo.json" }, module=sys.modules[__name__])  # OMEMO

    xmpp.connect()
    loop.run_forever()

if __name__ == "__main__":
    main()