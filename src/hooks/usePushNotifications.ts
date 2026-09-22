import { useCallback, useEffect, useState } from 'react';
import { trpc } from '@/providers/trpc';

// El navegador exige la clave publica VAPID como Uint8Array, no como el
// string base64url que devuelve el servidor.
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i++) outputArray[i] = rawData.charCodeAt(i);
  return outputArray;
}

export function usePushNotifications(codigo: string) {
  const soportado = typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window;
  const [suscrito, setSuscrito] = useState(false);
  const [cargando, setCargando] = useState(false);

  const { data: vapidData } = trpc.notificaciones.vapidPublicKey.useQuery(undefined, { enabled: soportado });
  const suscribirMutation = trpc.notificaciones.suscribir.useMutation();
  const desuscribirMutation = trpc.notificaciones.desuscribir.useMutation();

  useEffect(() => {
    if (!soportado) return;
    navigator.serviceWorker.ready
      .then((reg) => reg.pushManager.getSubscription())
      .then((sub) => setSuscrito(!!sub))
      .catch(() => {});
  }, [soportado]);

  const activar = useCallback(async () => {
    if (!soportado || !codigo || !vapidData?.publicKey) return;
    setCargando(true);
    try {
      const permiso = await Notification.requestPermission();
      if (permiso !== 'granted') return;

      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidData.publicKey) as BufferSource,
      });
      const json = sub.toJSON();
      if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) return;

      await suscribirMutation.mutateAsync({
        userId: codigo,
        endpoint: json.endpoint,
        keys: { p256dh: json.keys.p256dh, auth: json.keys.auth },
      });
      setSuscrito(true);
    } finally {
      setCargando(false);
    }
  }, [soportado, codigo, vapidData, suscribirMutation]);

  const desactivar = useCallback(async () => {
    if (!soportado) return;
    setCargando(true);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await desuscribirMutation.mutateAsync({ endpoint: sub.endpoint });
        await sub.unsubscribe();
      }
      setSuscrito(false);
    } finally {
      setCargando(false);
    }
  }, [soportado, desuscribirMutation]);

  return { soportado, suscrito, cargando, activar, desactivar };
}
