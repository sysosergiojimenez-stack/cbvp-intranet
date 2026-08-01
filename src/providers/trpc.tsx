import { createTRPCReact } from "@trpc/react-query";
import { httpBatchLink } from "@trpc/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import superjson from "superjson";
import type { AppRouter } from "../../api/router";
import type { ReactNode } from "react";
import { getAdminAuthHeader } from "@/lib/adminAuth";

export const trpc = createTRPCReact<AppRouter>();

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
      // Actualizacion en "tiempo real": refresca en segundo plano cada 20s
      // para que los cambios hechos por otros usuarios/dispositivos aparezcan
      // sin que haya que recargar la pagina manualmente. Tambien refresca al
      // volver a la pestaña/ventana.
      refetchInterval: 20000,
      refetchIntervalInBackground: false,
      refetchOnWindowFocus: true,
    },
    mutations: {
      retry: false,
    },
  },
});

const trpcClient = trpc.createClient({
  links: [
    httpBatchLink({
      url: "/api/trpc",
      transformer: superjson,
      headers() {
        const auth = getAdminAuthHeader();
        return auth ? { Authorization: auth } : {};
      },
      fetch(input, init) {
        return globalThis.fetch(input, {
          ...(init ?? {}),
          credentials: "include",
        }).catch((err) => {
          // Network error - backend not reachable
          throw new Error("No se pudo conectar con el servidor. Verifica que el backend este en ejecucion.");
        });
      },
    }),
  ],
});

export function TRPCProvider({ children }: { children: ReactNode }) {
  return (
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    </trpc.Provider>
  );
}
