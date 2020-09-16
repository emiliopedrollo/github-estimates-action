const core = require('@actions/core')
const github = require('@actions/github')
const { Octokit } = require("@octokit/rest")

try {
    const token = core.getInput('token')
    const owner = core.getInput('owner')
    const repo = core.getInput('repo')

    const payload = JSON.stringify(github.context.payload, undefined, 2)
    //console.log(`The event payload: ${payload}`)


    const octokit = new Octokit({
        auth: token,
        previews: ["inertia-preview"]
    })

    octokit.paginate("GET /repos/:owner/:repo/projects", { owner, repo }).then((projects) => (
        projects.map((project) => (
            octokit.paginate(project.columns_url).then((columns) => (
                columns.map((column) => {
                    octokit.paginate(column.cards_url).then((cards) => (
                        Promise.all(cards.map((card) => (
                            octokit.issues.get({
                                owner,
                                repo,
                                issue_number: /[^/]*$/.exec(card.content_url)[0]
                            }).then((issue) => {
                                let estimate = 0
                                if (issue) {
                                    estimate = issue.body.match(/estimate:\s*(\d+)/)[1] || 0
                                }
                                return estimate
                            }).catch((e) => core.setFailed(e.message))
                            // octokit.issues.listLabelsOnIssue({
                            //     owner,
                            //     repo,
                            //     issue_number: /[^/]*$/.exec(card.content_url)[0]
                            // }).then(({ data: labels }) => {
                            //     let total = 0
                            //
                            //     labels.filter((l) => l.description = 'Story Point').map((l) => {
                            //         total = total + parseInt(l.name)
                            //     })
                            //
                            //     return total
                            // }).catch((e) => core.setFailed(e.message))
                        ))).then((estimates) => {

                            let name = ''
                            const columnTotal = estimates.reduce((a, b) => a + b, 0)
                            const numStringRegex = /\([0-9]+\)/gi

                            if (column.name.search(numStringRegex) === -1) {
                                name = `${column.name} (${columnTotal})`
                            } else {
                                name = column.name.replace(numStringRegex, `(${columnTotal})`)
                            }

                            octokit.projects.updateColumn({
                                column_id: column.id,
                                name,
                            })
                        }).catch((e) => core.setFailed(e.message))
                    )).catch((e) => core.setFailed(e.message))
                })
            )).catch((e) => core.setFailed(e.message))
        ))
    ))
} catch (error) {
    core.setFailed(error.message)
}
