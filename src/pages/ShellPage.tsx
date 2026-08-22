import { Banner, PageHead } from '../components/ui';

/**
 * Honest shell for areas that are planned but not built. Says so plainly and
 * describes what the area will cover — never an invented feature, and never
 * the project's internal vocabulary.
 */
export default function ShellPage({ title, scope }: { title: string; scope: string }) {
  return (
    <div>
      <PageHead title={title} hint="not available yet" />
      <Banner kind="warn">
        This part of the platform is <b>not available yet</b>. Rather than show a screen that
        looks like it works, nothing has been built here. What this area will cover: {scope}
      </Banner>
    </div>
  );
}
