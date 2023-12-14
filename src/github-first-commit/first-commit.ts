import { pipe }                   from '../lib/util.js'
import { State, openFirstCommit } from './util.js'

export type Options = {
    timeout?: number;
}

const DEFAULT_TIMEOUT = 1_000 // 1 second

// the markup is different for anon vs logged-in users. rather than using
// different selectors for each case, use a query which works for both.
//
// when not logged in, the markup is pretty much free of semantic hooks, so we
// find the (first [1]) commit-history icon (clock) and navigate up to its
// enclosing link
//
// [1] there may be two copies of the commit-history icon in the commit bar, the
// second (inside a.react-last-commit-history-icon) in a hidden commit-history
// button (with no text) at the end of the bar, which is selected for mobile
// displays
const getCommitHistoryButton = (root: Element): HTMLAnchorElement | null => {
    return root.querySelector('svg.octicon.octicon-history')
        ?.closest('a:not(.react-last-commit-history-icon)') || null
}

/*
 * before:
 *
 * <ul>
 *     <li>
 *         <a data-pjax="..." data-turbo-frame="..." href="/foo/bar/commits/master/">
 *             <svg role="img">
 *                 [clock icon]
 *             </svg>
 *             <span class="d-none d-sm-inline">
 *                 <strong>123</strong> <!-- XXX label -->
 *                 <span class="color-fg-muted d-none d-lg-inline">
 *                     commits
 *                 </span>
 *             </span>
 *         </a>
 *     </li>
 * </ul>
 *
 * after:
 *
 * <ul>
 *     <li>
 *         <a id="first-commit">
 *             <svg role="img">
 *                 [clock icon]
 *             </svg>
 *             <span class="d-none d-sm-inline">
 *                 <strong>123</strong> <!-- XXX label -->
 *             </span>
 *         </a>
 *     </li>
 * </ul>
 */
export default class FirstCommit {
    protected isLoggedIn = false;
    protected timeout: number;

    constructor (protected state: State, options: Options = {}) {
        this.timeout = options.timeout || DEFAULT_TIMEOUT
    }

    protected append ($target: JQuery, $firstCommit: JQuery): void {
        const $targetLi = $target.parent('li')
        const $firstCommitLi = $($targetLi[0].cloneNode(false) as HTMLLIElement)
            .empty()
            .append($firstCommit)

        $targetLi.after($firstCommitLi)
    }

    /*
     * add the "1st Commit" button after the commit-history ("123 Commits") button
     */
    protected attach (target: HTMLElement) {
        console.log('inside attach:', target)

        // clone and tweak the commit-history button to create the "1st Commit" button
        const $target = $(target)

        const $firstCommit = $target
            .clone()
            .removeAttr('href data-pjax data-turbo-frame')
            .removeClass('react-last-commit-history-group')
            .attr({
                'aria-label': 'First commit',
                'id':         'first-commit',
            })
            .css('cursor', 'pointer')

        const $label = this.findLabel($firstCommit)

        $label.text('1st Commit')

        const [user, repo] = $('meta[name="octolytics-dimension-repository_network_root_nwo"][content]')
            .attr('content')!
            .split('/')

        $firstCommit.one('click', () => {
            $label.text('Loading...')
            openFirstCommit(user, repo) // async
            return false // stop processing the click
        })

        console.log('attaching first-commit button:', $firstCommit[0])

        this.append($target, $firstCommit)
    }

    protected findLabel ($firstCommit: JQuery) {
        const $label = $firstCommit.find(':scope span > strong').first()

        // cash-dom doesn't support $el.end()
        // https://github.com/fabiospampinato/cash/issues/260
        $label.nextAll().remove()

        return $label
    }

    protected getRoot (): HTMLElement | null {
        return document.getElementById('js-repo-pjax-container')
    }

    protected handleFirstCommitButton (firstCommit: HTMLElement): boolean {
        console.debug('removing obsolete first-commit button')
        firstCommit.remove()
        return true
    }

    // in most cases, the "turbo:load" event signals that the (SPA) page has
    // finished loading and is ready to be queried and updated (i.e. the SPA
    // equivalent of DOMContentLoaded), but that's not the case for the
    // commit-history button, which can either be:
    //
    // a) already loaded (full page load)
    // b) not there yet (still loading)
    // c) already loaded or still loading, but invalid
    //
    // b) and c) can occur when navigating to a repo page via the back button or via
    // on-site links, including self-links (i.e. from a repo page to itself).
    //
    // in the c) case, the old button is displayed (with the old first-commit button
    // still attached) before being replaced by the final, updated version, unless
    // the user is not logged in, in which case the old first-commit button is not
    // replaced.
    //
    // this method handles all 3 cases
    public onLoad (_event: Event) {
        const state = this.state

        // the nearest ancestor (with a stable-looking identifier) which doesn't
        // get blown away when the section is rebuilt
        const root = this.getRoot()

        if (!root) {
            console.warn("can't find root element!")
            return
        }

        let timerHandle = 0
        let disconnected = false

        const disconnect = () => {
            if (disconnected) {
                return
            }

            disconnected = true
            observer.disconnect()

            if (timerHandle) {
                pipe(timerHandle, $timerHandle => {
                    timerHandle = 0
                    clearTimeout($timerHandle)
                })
            }
        }

        const timeout = () => {
            console.warn(`timed out after ${this.timeout}ms`)
            disconnect()
        }

        const callback: MutationCallback = mutations => {
            console.debug('inside mutation callback:', mutations)

            // make sure we've gone high enough up the tree to find a persistent
            // container element. it's not just the commit-history button or
            // the commit-info bar it's contained in (table row) which gets torn
            // down and replaced - it's the entire central section of the
            // page
            if (!root.isConnected) {
                console.warn('root is not connected:', root)
                disconnect()
                return
            }

            // make sure we're still in the same "turbo:load" event, i.e.
            // haven't navigated to a new page
            if (generation !== state.generation) {
                console.warn('obsolete page:', { generation, state })
                disconnect()
                return
            }

            // make sure we're not displaying the old commit-history button
            // (identifiable by the fact it still has a first-commit button
            // attached to it). it's obsolete and will be replaced
            //
            // const firstCommit = document.querySelector('a#first-commit')
            const firstCommit = document.getElementById('first-commit')

            if (firstCommit) {
                console.debug('obsolete button:', firstCommit)

                const handled = this.handleFirstCommitButton(firstCommit)

                if (!handled) {
                    return
                }
            }

            const commitHistoryButton = getCommitHistoryButton(root)

            if (commitHistoryButton) {
                console.debug('found commit-history button')
                disconnect()
                queueMicrotask(() => this.attach(commitHistoryButton))
            }
        }

        const generation = state.generation
        const observer = new MutationObserver(callback)

        callback([], observer)

        if (!disconnected) {
            timerHandle = setTimeout(timeout, this.timeout)
            observer.observe(root, { childList: true, subtree: true })
        }
    }
}
