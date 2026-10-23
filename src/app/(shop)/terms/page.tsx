import { CmsPageView, cmsMetadata } from '@/components/shop/cms-page';

export const generateMetadata = () => cmsMetadata('terms');

export default function Page() {
  return <CmsPageView slug="terms" />;
}
