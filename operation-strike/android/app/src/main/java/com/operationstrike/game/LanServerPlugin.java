package com.operationstrike.game;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import org.java_websocket.WebSocket;
import org.java_websocket.handshake.ClientHandshake;
import org.java_websocket.server.WebSocketServer;

import java.net.Inet4Address;
import java.net.InetAddress;
import java.net.InetSocketAddress;
import java.net.NetworkInterface;
import java.util.Collections;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicInteger;

/**
 * Partida em Wi-Fi local: o celular anfitrião abre um servidor WebSocket na rede (Wi-Fi ou roteador do celular)
 * e repassa as mensagens dos convidados para o jogo (que roda a partida). Não usa internet.
 * Eventos para o jogo: "open" {id, addr}, "message" {id, data}, "close" {id}.
 */
@CapacitorPlugin(name = "LanServer")
public class LanServerPlugin extends Plugin {
    private WebSocketServer server;
    private final Map<Integer, WebSocket> conns = new ConcurrentHashMap<>();
    private final AtomicInteger nextId = new AtomicInteger(1);

    @PluginMethod
    public void start(final PluginCall call) {
        stopServer();
        final int port = call.getInt("port", 8787);
        final int maxClients = call.getInt("maxClients", 9);
        try {
            server = new WebSocketServer(new InetSocketAddress(port)) {
                @Override
                public void onOpen(WebSocket conn, ClientHandshake handshake) {
                    if (conns.size() >= maxClients) {
                        conn.close(1013, "sala cheia");
                        return;
                    }
                    int id = nextId.getAndIncrement();
                    conn.setAttachment(id);
                    conns.put(id, conn);
                    JSObject ev = new JSObject();
                    ev.put("id", id);
                    ev.put("addr", conn.getRemoteSocketAddress() != null ? conn.getRemoteSocketAddress().getAddress().getHostAddress() : "");
                    notifyListeners("open", ev);
                }

                @Override
                public void onClose(WebSocket conn, int code, String reason, boolean remote) {
                    Integer id = conn.getAttachment();
                    if (id == null) return;
                    conns.remove(id);
                    JSObject ev = new JSObject();
                    ev.put("id", id);
                    notifyListeners("close", ev);
                }

                @Override
                public void onMessage(WebSocket conn, String message) {
                    Integer id = conn.getAttachment();
                    if (id == null || message.length() > 65536) return;
                    JSObject ev = new JSObject();
                    ev.put("id", id);
                    ev.put("data", message);
                    notifyListeners("message", ev);
                }

                @Override
                public void onError(WebSocket conn, Exception ex) {
                    JSObject ev = new JSObject();
                    ev.put("error", String.valueOf(ex.getMessage()));
                    notifyListeners("error", ev);
                }

                @Override
                public void onStart() {
                    setConnectionLostTimeout(10);
                }
            };
            server.setReuseAddr(true);
            server.setTcpNoDelay(true);
            server.start();
            JSObject ret = new JSObject();
            ret.put("port", port);
            ret.put("ips", addresses());
            call.resolve(ret);
        } catch (Exception e) {
            call.reject("Não foi possível abrir a sala local: " + e.getMessage());
        }
    }

    @PluginMethod
    public void send(PluginCall call) {
        Integer id = call.getInt("id");
        String data = call.getString("data");
        WebSocket c = id == null ? null : conns.get(id);
        if (c != null && c.isOpen() && data != null) c.send(data);
        call.resolve();
    }

    @PluginMethod
    public void kick(PluginCall call) {
        Integer id = call.getInt("id");
        WebSocket c = id == null ? null : conns.get(id);
        if (c != null) c.close(1000, "removido");
        call.resolve();
    }

    @PluginMethod
    public void stop(PluginCall call) {
        stopServer();
        call.resolve();
    }

    @PluginMethod
    public void getAddresses(PluginCall call) {
        JSObject ret = new JSObject();
        ret.put("ips", addresses());
        call.resolve(ret);
    }

    private void stopServer() {
        if (server != null) {
            try {
                server.stop(500);
            } catch (Exception ignored) {
            }
            server = null;
        }
        conns.clear();
    }

    /** Endereços IPv4 da rede local (Wi-Fi ou roteador do celular). */
    private JSArray addresses() {
        JSArray list = new JSArray();
        try {
            for (NetworkInterface ni : Collections.list(NetworkInterface.getNetworkInterfaces())) {
                if (!ni.isUp() || ni.isLoopback()) continue;
                for (InetAddress a : Collections.list(ni.getInetAddresses())) {
                    if (a instanceof Inet4Address && a.isSiteLocalAddress()) list.put(a.getHostAddress());
                }
            }
        } catch (Exception ignored) {
        }
        return list;
    }

    @Override
    protected void handleOnDestroy() {
        stopServer();
    }
}
