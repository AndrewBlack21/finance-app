import { ScrollViewStyleReset } from "expo-router/html";

export default function Root({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        {/* A linha abaixo (viewport-fit=cover) impede que a tela fuja do Notch do iPhone */}
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, shrink-to-fit=no, viewport-fit=cover, maximum-scale=1.0, user-scalable=no"
        />

        {/* Reset padrão do Expo */}
        <ScrollViewStyleReset />

        {/* CSS Mágico para PWA no iOS */}
        <style
          dangerouslySetInnerHTML={{
            __html: `
          body {
            /* Desliga o efeito de "sambar" do Safari */
            overscroll-behavior: none; 
            /* Trava o scroll no corpo inteiro da página */
            overflow: hidden; 
            background-color: #f8fafc;
          }
          #root {
            /* Usa 100dvh (Dynamic Viewport) em vez de 100vh para ignorar a barra do Safari */
            height: 100dvh; 
          }
        `,
          }}
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
