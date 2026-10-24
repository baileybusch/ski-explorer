import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle } from '@/components/ui/drawer';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';

export function PlanDialog({ open, onOpenChange, text, links }: { open: boolean; onOpenChange: (v: boolean) => void; text: string; links: { chatgpt?: string; grok?: string } }) {
  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-h-[88dvh]" data-testid="plan-sheet">
        <DrawerHeader>
          <DrawerTitle>Plan this trip</DrawerTitle>
          <DrawerDescription>Copy the brief, or open ChatGPT / Grok. Claude no longer takes a prefilled URL.</DrawerDescription>
        </DrawerHeader>
        <div className="flex flex-col gap-3 px-4 pb-6">
          <Textarea readOnly value={text} className="min-h-48 text-base" />
          <Button className="min-h-12" onClick={async () => { await navigator.clipboard.writeText(text); toast('Brief copied'); }}>Copy brief</Button>
          {links.chatgpt ? <Button variant="outline" className="min-h-12" asChild><a href={links.chatgpt} target="_blank" rel="noopener">Open in ChatGPT</a></Button> : null}
          {links.grok ? <Button variant="outline" className="min-h-12" asChild><a href={links.grok} target="_blank" rel="noopener">Open in Grok</a></Button> : null}
        </div>
      </DrawerContent>
    </Drawer>
  );
}
