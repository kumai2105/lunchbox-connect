import { Banner, PageHead } from '../components/ui';

/**
 * Honest shell for approved-but-undefined spec areas. Renders the approved
 * scope statement and a NOT_YET_DEFINED banner — never an invented feature.
 */
export default function ShellPage({ title, scope }: { title: string; scope: string }) {
  return (
    <div>
      <PageHead title={title} hint="approved area — implementation pending spec detail" />
      <Banner kind="warn">
        This area is <b>NOT_YET_DEFINED</b> in the approved specification pack (docs 04/05). Its
        scope and state rules are not approved yet, so nothing has been invented here. The confirmed
        working scope: {scope}
      </Banner>
    </div>
  );
}
