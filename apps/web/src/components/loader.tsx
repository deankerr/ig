import { Spinner } from '@/components/ui/spinner'

export function Loader() {
  return (
    <div className="flex flex-1 items-center justify-center">
      <Spinner />
    </div>
  )
}
