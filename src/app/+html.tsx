import { ScrollViewStyleReset } from "expo-router/html";

export default function Root({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        {/* 👇 META VIEWPORT BLINDADA: Trava a escala em 1.0 e desativa o user-scalable */}
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=0, shrink-to-fit=no, viewport-fit=cover"
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
          /* 1. BLOQUEIO DE ZOOM DE DUPLO CLIQUE (Double Tap) */
          *, *::before, *::after {
            box-sizing: border-box;
            touch-action: manipulation !important; /* Desativa o double-tap to zoom */
            -webkit-tap-highlight-color: transparent;
          }

          /* 2. TRAVA O "SAMBA" (EFEITO ELÁSTICO / RUBBER-BANDING) DO NAVEGADOR */
          /* Note que removemos o 'position: fixed' que quebrava o teclado */
          html, body, #root {
            width: 100%;
            height: 100%;
            margin: 0;
            padding: 0;
            overflow: hidden !important; /* Esconde a rolagem da tela inteira */
            overscroll-behavior-y: none !important; /* Trava a puxada elástica da janela */
            background-color: #f8fafc;
          }

          /* 3. Evita que o texto redimensione sozinho ao virar o celular */
          body {
            -webkit-text-size-adjust: 100%;
          }

          /* 4. ROLAGEM SUAVE APENAS DENTRO DAS LISTAS (ScrollViews) */
          [data-rnw-class="ScrollView"], .css-view-175oi2r {
            -webkit-overflow-scrolling: touch !important;
            overscroll-behavior: contain !important; /* Impede que o scroll interno vaze e puxe a tela toda */
          }
        `,
          }}
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
