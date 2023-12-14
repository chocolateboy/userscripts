type Commits = Array<{ html_url: string }>;

export type State = {
    readonly generation: number;
}

/*
 * this function extracts the URL of the repo's first commit and navigates to it.
 * it is based on code by several developers, a list of whom can be found here:
 * https://github.com/FarhadG/init#contributors
 *
 * XXX it doesn't work on private repos. a way to do that can be found here,
 * but it requires an authentication token:
 * https://gist.github.com/simonewebdesign/a70f6c89ffd71e6ba4f7dcf7cc74ccf8
 */
export function openFirstCommit(user: string, repo: string) {
    return fetch(`https://api.github.com/repos/${user}/${repo}/commits`)
        // the `Link` header has additional URLs for paging.
        // parse the original JSON for the case where no other pages exist
        .then(res => Promise.all([res.headers.get('link'), res.json() as Promise<Commits>]))

        .then(([link, commits]) => {
            if (!link) {
                // if there's no link, we know we're on the only page
                return commits
            }

            // the link header contains two URLs and has the following
            // format (wrapped for readability):
            //
            //  <https://api.github.com/repositories/1234/commits?page=2>; rel="next",
            //  <https://api.github.com/repositories/1234/commits?page=9>; rel="last"

            // extract the URL of the last page (commits are ordered in
            // reverse chronological order, like the git CLI, so the oldest
            // commit is on the last page)

            const lastPage = link.match(/^.+?<([^>]+)>;/)![1]

            // fetch the last page of results
            return fetch(lastPage).then(res => res.json())
        })

        // get the last commit and navigate to its target URL
        .then((commits: Commits) => {
            if (Array.isArray(commits)) {
                location.href = commits[commits.length - 1].html_url
            } else {
                console.error(commits)
            }
        })
}
