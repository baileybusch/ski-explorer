import { Button } from '@/components/ui/button';
import { type LocalRule, deleteLocalRule, ruleSummary, updateLocalRule } from '@/lib/alertRules';

export function AlertsList({
  rules, resorts, onAlert, onEdit, onChange,
}: {
  rules: LocalRule[];
  resorts: { id: string; name: string }[];
  onAlert: () => void;
  onEdit?: (rule: LocalRule) => void;
  onChange: () => void;
}) {
  if (!rules.length) {
    return (
      <div className="flex flex-col gap-4" data-testid="alerts-empty">
        <p className="text-sm text-muted-foreground">No alerts yet. Pick a resort and we&apos;ll email you when it&apos;s about to get dumped on.</p>
        <Button type="button" className="min-h-12 w-full text-base" data-testid="alerts-empty-cta" onClick={onAlert}>
          Alert me
        </Button>
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-3" data-testid="my-alerts">
      {rules.map(rule => (
        <div key={rule.id} className="rounded-2xl p-3 ring-1 ring-foreground/12" data-testid="alert-rule">
          <p className="text-base font-medium">{ruleSummary(rule, resorts)}</p>
          <p className="text-xs text-muted-foreground">
            {rule.paused ? 'Paused' : 'On'} · {rule.recap ? 'recap on' : 'recap off'}
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            <Button type="button" variant="ghost" className="min-h-11 px-3 text-sm" onClick={() => { updateLocalRule(rule.id, { paused: !rule.paused }); onChange(); }}>
              {rule.paused ? 'Resume' : 'Pause'}
            </Button>
            <Button type="button" variant="ghost" className="min-h-11 px-3 text-sm" onClick={() => onEdit?.(rule)}>
              Edit
            </Button>
            <Button type="button" variant="ghost" className="min-h-11 px-3 text-sm" onClick={() => { deleteLocalRule(rule.id); onChange(); }}>
              Delete
            </Button>
          </div>
        </div>
      ))}
      <Button type="button" variant="ghost" className="min-h-12 w-full text-base" onClick={onAlert}>
        Alert me
      </Button>
    </div>
  );
}
