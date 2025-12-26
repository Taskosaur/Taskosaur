import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import { shareApi, PublicSharedTask } from '@/utils/api/shareApi';
import PublicTaskView from '@/components/public/PublicTaskView';
import { HiExclamationTriangle, HiClock } from 'react-icons/hi2';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

export default function PublicTaskPage() {
  const router = useRouter();
  const { token } = router.query;
  
  const [task, setTask] = useState<PublicSharedTask | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (token && typeof token === 'string') {
      fetchTask(token);
    }
  }, [token]);

  const fetchTask = async (tokenStr: string) => {
    try {
      const data = await shareApi.getPublicTask(tokenStr);
      setTask(data);
    } catch (err: any) {
      if (err.response?.status === 404) {
        setError(err.response?.data?.message || 'Link expired or not found');
      } else {
        setError('Failed to load task');
      }
    } finally {
      setLoading(false);
    }
  };

  if (!token) return null;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (error || !task) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 dark:bg-gray-900 p-4 font-sans">
        <div className="max-w-md w-full bg-white dark:bg-gray-950 p-8 rounded-xl shadow-lg text-center space-y-6">
          <div className="mx-auto w-16 h-16 bg-red-100 dark:bg-red-900/20 rounded-full flex items-center justify-center">
            {error?.toLowerCase().includes('expire') ? (
              <HiClock className="w-8 h-8 text-red-600 dark:text-red-400" />
            ) : (
              <HiExclamationTriangle className="w-8 h-8 text-red-600 dark:text-red-400" />
            )}
          </div>
          
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            {error?.toLowerCase().includes('expire') ? 'Link Expired' : 'Access Denied'}
          </h1>
          
          <p className="text-gray-500 dark:text-gray-400">
            {error || 'This shared link is invalid or has been revoked.'}
          </p>

          <Button asChild className="w-full">
            <Link href="/">
              Go to Homepage
            </Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <>
      <Head>
        <title>{task.title} | Taskosaur Shared View</title>
        <meta name="robots" content="noindex, nofollow" />
      </Head>
      <PublicTaskView task={task} token={token as string} />
    </>
  );
}


