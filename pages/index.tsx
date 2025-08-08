
import Head from 'next/head';

export default function Home() {
  return (
    <>
      <Head>
        <title>Fila Zero Bar</title>
      </Head>
      <main style={{ padding: '2rem', fontFamily: 'sans-serif' }}>
        <h1>🍹 Bem-vindo ao Fila Zero Bar</h1>
        <p>Escaneie o QR code para pedir seu drink.</p>
      </main>
    </>
  );
}
