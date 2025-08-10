import Head from 'next/head'

export default function MyApp({ Component, pageProps }) {
  return (
    <>
      <Head>
        <title>Fila Zero Bar</title>
      </Head>
      <Component {...pageProps} />
      <style jsx global>{`
        html, body {
          -webkit-text-size-adjust: 100%;
        }
        /* Evita zoom ao focar nos inputs no iOS (font-size >= 16px) */
        input, select, textarea, button {
          font-size: 17px;
        }
      `}</style>
    </>
  )
}
