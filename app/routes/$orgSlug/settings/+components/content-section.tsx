import { ScrollArea } from '~/app/components/ui/scroll-area'
import { Separator } from '~/app/components/ui/separator'

interface ContentSectionProps {
  title: string
  desc: string
  fullWidth?: boolean
  children: React.ReactNode
}

export default function ContentSection({
  title,
  desc,
  fullWidth,
  children,
}: ContentSectionProps) {
  return (
    <div className="flex flex-1 flex-col">
      <div className="flex-none">
        <h3 className="text-lg font-medium">{title}</h3>
        <p className="text-muted-foreground text-sm">{desc}</p>
      </div>
      <Separator className="my-4 flex-none" />
      {fullWidth ? (
        <div className="-mx-4 flex-1 overflow-auto px-4">{children}</div>
      ) : (
        <ScrollArea className="-mx-4 flex-1 scroll-smooth px-4 md:pb-16">
          <div className="-mx-1 px-1.5 lg:max-w-xl">{children}</div>
        </ScrollArea>
      )}
    </div>
  )
}
