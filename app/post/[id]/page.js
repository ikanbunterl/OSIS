import DetailPost from './DetailPost';

export const metadata = { title: 'Detail Post', robots: { index: false } };
export const dynamic = 'force-dynamic';

export default async function PostPage({ params }) {
  const { id } = await params;
  return <DetailPost id={id} />;
}
