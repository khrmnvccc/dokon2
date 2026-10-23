import { CmsPageView, cmsMetadata } from '@/components/shop/cms-page';

export const generateMetadata = () => cmsMetadata('privacy');

export default function Page() {
  return <CmsPageView slug="privacy" />;
}
