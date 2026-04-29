import { LightbulbIcon } from 'lucide-react'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '~/app/components/ui/card'

interface InsightsCardProps {
  insights: string[]
}

export function InsightsCard({ insights }: InsightsCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Insights</CardTitle>
        <CardDescription>
          Auto-generated highlights based on the current period data.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {insights.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            Nothing notable surfaced for this period.
          </p>
        ) : (
          <ul className="space-y-3">
            {insights.map((text) => (
              <li key={text} className="flex items-start gap-2 text-sm">
                <LightbulbIcon className="text-muted-foreground mt-0.5 size-4 shrink-0" />
                <span className="leading-snug">{text}</span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}
