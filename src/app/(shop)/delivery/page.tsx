import { CmsPageView, cmsMetadata } from '@/components/shop/cms-page';

export const generateMetadata = () => cmsMetadata('delivery');

export default function Page() {
  return <CmsPageView slug="delivery" />;
}
