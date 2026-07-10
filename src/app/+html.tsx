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

        <link rel="apple-touch-icon" href="/assets/icon.png" />
        <link rel="apple-touch-icon" sizes="152x152" href="/assets/icon.png" />
        <link rel="apple-touch-icon" sizes="180x180" href="/assets/icon.png" />

        <meta name="theme-color" content="#6366f1" />
        <link rel="manifest" href="/manifest.json" />

        <ScrollViewStyleReset />

        <style
          dangerouslySetInnerHTML={{
            __html: `
          *, *::before, *::after {
            box-sizing: border-box;
            touch-action: manipulation;
            -webkit-tap-highlight-color: transparent;
          }

          html {
            position: fixed;
            width: 100%;
            height: 100%;
            overflow: hidden;
          }

          body {
            position: fixed;
            width: 100%;
            height: 100%;
            overflow: hidden;
            overscroll-behavior: none;
            -webkit-overflow-scrolling: auto;
            background-color: #f8fafc;
            /* OS PADDINGS DA APPLE FORAM REMOVIDOS DAQUI PARA O MENU VOLTAR A APARECER */
          }

          #root {
            width: 100%;
            height: 100dvh;
            overflow: hidden;
            position: relative;
          }

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
