import { CmsPageView, cmsMetadata } from '@/components/shop/cms-page';

export const generateMetadata = () => cmsMetadata('faq');

export default function Page() {
  return <CmsPageView slug="faq" accordion />;
}
