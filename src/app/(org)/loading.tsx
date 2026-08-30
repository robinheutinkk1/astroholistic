import { PageSkeleton } from '@/components/ui/skeleton';

/**
 * Eén laadgrens voor de hele plannershell. De zijbalk en de kop blijven staan
 * (die zitten in de layout); alleen de pagina-inhoud wordt een skelet.
 */
export default function Loading() {
  return <PageSkeleton />;
}
