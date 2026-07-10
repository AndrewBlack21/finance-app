import { ScrollViewStyleReset } from "expo-router/html";

export default function Root({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, shrink-to-fit=no, viewport-fit=cover, maximum-scale=1.0, user-scalable=no"
        />

        {/* ── iOS PWA — ESSENCIAIS ─────────────────────────── */}
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta
          name="apple-mobile-web-app-status-bar-style"
          content="black-translucent"
        />
        <meta name="apple-mobile-web-app-title" content="Finance App" />

        {/* ── Ícones para home screen do iOS ──────────────── */}
        <link rel="apple-touch-icon" href="/assets/icon.png" />
        <link rel="apple-touch-icon" sizes="152x152" href="/assets/icon.png" />
        <link rel="apple-touch-icon" sizes="180x180" href="/assets/icon.png" />

        <meta name="theme-color" content="#6366f1" />
        <link rel="manifest" href="/manifest.json" />

        <ScrollViewStyleReset />

        <style
          dangerouslySetInnerHTML={{
            __html: `
          /* ── Reset global ─────────────────────────────────── */
          *, *::before, *::after {
            box-sizing: border-box;
            /* Remove delay de 300ms no toque — responsividade imediata */
            touch-action: manipulation;
            /* Remove flash azul ao tocar em elementos */
            -webkit-tap-highlight-color: transparent;
          }

          html {
            /* Trava o html — impede o bounce do Safari */
            position: fixed;
            width: 100%;
            height: 100%;
            overflow: hidden;
          }

          body {
            /* Trava o body também — dupla proteção anti-bounce */
            position: fixed;
            width: 100%;
            height: 100%;
            overflow: hidden;

            /* Remove o efeito elástico (sambando) do iOS */
            overscroll-behavior: none;
            -webkit-overflow-scrolling: auto;

            background-color: #f8fafc;

            /* Respeita o notch e a home bar do iPhone */
            padding-top: env(safe-area-inset-top);
            padding-bottom: env(safe-area-inset-bottom);
            padding-left: env(safe-area-inset-left);
            padding-right: env(safe-area-inset-right);
          }

          #root {
            /* Ocupa toda a tela dinâmica (ignora barra do Safari) */
            width: 100%;
            height: 100dvh;
            overflow: hidden;
            position: relative;
          }

          /* ── Scroll suave APENAS nos elementos que precisam ── */
          /* O scroll interno (FlatList, ScrollView) deve funcionar */
          [data-rnw-class],
          .css-view-175oi2r {
            -webkit-overflow-scrolling: touch;
          }
        `,
          }}
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
