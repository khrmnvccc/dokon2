import { markdownToHtml } from '@/lib/markdown';
import { cn } from '@/components/ui/cn';

export function Markdown({ content, accordion, className }: { content: string; accordion?: boolean; className?: string }) {
  return <div className={cn('prose-dk', accordion && 'faq', className)} dangerouslySetInnerHTML={{ __html: markdownToHtml(content, { accordion }) }} />;
}
