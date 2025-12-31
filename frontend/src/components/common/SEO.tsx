import Head from "next/head";

interface SEOProps {
  title?: string;
  description?: string;
}

export const SEO = ({ 
  title, 
  description = "Taskosaur - Modern, AI-powered task management for productive teams.",
}: SEOProps) => {
  const siteTitle = "Taskosaur";
  const displayTitle = title ? `${title} | ${siteTitle}` : siteTitle;

  return (
    <Head>
      <title>{displayTitle}</title>
      <meta name="description" content={description} />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <link rel="icon" href="/favicon.ico" />

      <meta name="theme-color" content="#6366f1" />
    </Head>
  );
};
