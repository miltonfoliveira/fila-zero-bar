
import Head from 'next/head';

export default function Bar() {
  return (
    <>
      <Head>
        <title>Painel do Bar</title>
      </Head>
      <main style={{ padding: '2rem', fontFamily: 'sans-serif' }}>
        <h1>🍸 Painel do Bar</h1>
        <p>Visualize e gerencie os pedidos de drinks aqui.</p>
      </main>
    </>
  );
}
