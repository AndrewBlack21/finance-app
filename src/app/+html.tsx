import { ScrollViewStyleReset } from "expo-router/html";

export default function Root({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=0, shrink-to-fit=no, viewport-fit=cover"
        />

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
          /* 1. BLOQUEIO DE ZOOM DE DUPLO CLIQUE */
          *, *::before, *::after {
            box-sizing: border-box;
            touch-action: manipulation !important; 
            -webkit-tap-highlight-color: transparent;
          }

          /* 2. LIBERA O EIXO VERTICAL (Para o pull-to-refresh) E TRAVA O HORIZONTAL */
          html, body, #root {
            width: 100%;
            height: 100%;
            margin: 0;
            padding: 0;
            overflow-x: hidden !important; /* Trava o balanço lateral */
            background-color: #f8fafc;
          }

          body {
            -webkit-text-size-adjust: 100%;
          }

          [data-rnw-class="ScrollView"], .css-view-175oi2r {
            -webkit-overflow-scrolling: touch !important;
          }
        `,
          }}
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
