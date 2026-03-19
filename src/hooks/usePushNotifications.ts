import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

// VAPID public key — generate at https://vapidkeys.com/ and set as env var
const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY || "";

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)));
}

export function usePushNotifications() {
  const { user } = useAuth();
  const [supported, setSupported] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission>("default");
  const [subscribed, setSubscribed] = useState(false);

  useEffect(() => {
    const sw = "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
    setSupported(sw);
    if (sw) setPermission(Notification.permission);
  }, []);

  // Register service worker once
  useEffect(() => {
    if (!supported) return;
    navigator.serviceWorker.register("/sw.js").catch(console.error);
  }, [supported]);

  const subscribe = async () => {
    if (!supported || !user) return false;

    try {
      const perm = await Notification.requestPermission();
      setPermission(perm);
      if (perm !== "granted") return false;

      const reg = await navigator.serviceWorker.ready;

      // If no VAPID key configured, use basic notifications (no server push)
      if (!VAPID_PUBLIC_KEY) {
        setSubscribed(true);
        return true;
      }

      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      });

      // Save subscription to Supabase
      await (supabase.from as any)("push_subscriptions").upsert({
        user_id: user.id,
        subscription: JSON.stringify(sub),
        updated_at: new Date().toISOString(),
      }, { onConflict: "user_id" });

      setSubscribed(true);
      return true;
    } catch (err) {
      console.error("Push subscription error:", err);
      return false;
    }
  };

  const sendLocalNotification = (title: string, body: string, url = "/") => {
    if (permission !== "granted") return;
    navigator.serviceWorker.ready.then((reg) => {
      reg.showNotification(title, {
        body,
        icon: "/favicon.ico",
        data: { url },
        badge: "/favicon.ico",
        vibrate: [200, 100, 200],
      });
    });
  };

  return { supported, permission, subscribed, subscribe, sendLocalNotification };
}
