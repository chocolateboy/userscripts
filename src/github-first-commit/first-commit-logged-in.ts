import FirstCommit from './first-commit.js'

/*
 * before:
 *
 * <div>
 *     <a aria-label="Commit history" href="/foo/bar/commits/master/">
 *         <span data-component="buttonContent">
 *             <span data-component="leadingVisual">
 *                 <svg role="img">
 *                     [clock icon]
 *                 </svg>
 *             </span>
 *             <span data-component="text">
 *                 <span>
 *                     123 Commits
 *                 </span>
 *             </span>
 *         </span>
 *     </a>
 * <div>
 *
 * after:
 *
 * <div>
 *     <a aria-label="Commit history" href="/foo/bar/commits/master/">...</a>
 *
 *     <a id="first-commit" aria-label="First commit">
 *         <span data-component="buttonContent">
 *             <span data-component="leadingVisual">
 *                 <svg role="img">
 *                     [clock icon]
 *                 </svg>
 *             </span>
 *             <span data-component="text">
 *                 <span> <!-- XXX label -->
 *                     1st Commit
 *                 </span>
 *             </span>
 *         </span>
 *     </a>
 * <div>
 */
export default class FirstCommitLoggedIn extends FirstCommit {
    protected override append ($target: JQuery, $firstCommit: JQuery): void {
        $target.after($firstCommit)
    }

    protected override findLabel ($firstCommit: JQuery): JQuery {
        return $firstCommit
            .find(':scope [data-component="text"] > span')
            .first()
    }

    protected override getRoot (): HTMLElement | null {
        return document.querySelector<HTMLElement>('[partial-name="repos-overview"]')
            || super.getRoot()
    }

    protected override handleFirstCommitButton (_firstCommit: HTMLElement): boolean {
        return false
    }
}
