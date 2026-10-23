import { CmsPageView, cmsMetadata } from '@/components/shop/cms-page';

export const generateMetadata = () => cmsMetadata('about');

export default function Page() {
  return <CmsPageView slug="about" />;
}
