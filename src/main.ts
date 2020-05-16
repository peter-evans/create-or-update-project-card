import * as core from '@actions/core'
import * as github from '@actions/github'
import {inspect} from 'util'

async function isOrg(octokit, owner): Promise<boolean> {
  try {
    await octokit.orgs.get({
      org: owner
    })
    return true
  } catch (error) {
    core.debug(inspect(error))
    return false
  }
}

async function getProjects(octokit, projectLocation): Promise<object> {
  const [owner, repo] = projectLocation.split('/')
  if (repo) {
    const {data: projects} = await octokit.projects.listForRepo({
      owner: owner,
      repo: repo
    })
    return projects
  } else if (await isOrg(octokit, owner)) {
    const {data: projects} = await octokit.projects.listForOrg({
      org: owner
    })
    return projects
  } else {
    const {data: projects} = await octokit.projects.listForUser({
      username: owner
    })
    return projects
  }
}

function getProject(projects, projectNumber, projectName): object {
  if (!isNaN(projectNumber) && projectNumber > 0) {
    return projects.find(project => project.number == projectNumber)
  } else if (projectName) {
    return projects.find(project => project.name == projectName)
  } else {
    throw 'A valid input for project-number OR project-name must be supplied.'
  }
}

async function getContent(octokit, repository, issueNumber): Promise<object> {
  const [owner, repo] = repository.split('/')
  const {data: issue} = await octokit.issues.get({
    owner: owner,
    repo: repo,
    issue_number: issueNumber
  })
  core.debug(`Issue: ${inspect(issue)}`)
  if (!issue)
    throw 'No issue or pull request matching the supplied input found.'

  if (issue['pull_request']) {
    const {data: pull} = await octokit.pulls.get({
      owner: owner,
      repo: repo,
      pull_number: issueNumber
    })
    return {
      id: pull['id'],
      url: issue['url'],
      type: 'PullRequest'
    }
  } else {
    return {
      id: issue['id'],
      url: issue['url'],
      type: 'Issue'
    }
  }
}

async function findCardInColumn(
  octokit,
  columnId,
  contentUrl,
  page = 1
): Promise<object> {
  const perPage = 100
  const {data: cards} = await octokit.projects.listCards({
    column_id: columnId,
    per_page: perPage,
    page: page
  })
  core.debug(`Cards: ${inspect(cards)}`)

  const card = cards.find(card => card.content_url == contentUrl)

  if (card) {
    return card
  } else if (cards.length == perPage) {
    return findCardInColumn(octokit, columnId, contentUrl, ++page)
  } else {
    return {}
  }
}

async function findCardInColumns(
  octokit,
  columns,
  contentUrl
): Promise<object> {
  for (const column of columns) {
    const card = await findCardInColumn(octokit, column['id'], contentUrl)
    core.debug(`findCardInColumn: ${inspect(card)}`)
    if (Object.keys(card).length > 0) {
      return card
    }
  }
  return {}
}

async function run(): Promise<void> {
  try {
    const inputs = {
      token: core.getInput('token'),
      projectLocation: core.getInput('project-location'),
      projectNumber: Number(core.getInput('project-number')),
      projectName: core.getInput('project-name'),
      columnName: core.getInput('column-name'),
      repository: core.getInput('repository'),
      issueNumber: Number(core.getInput('issue-number'))
    }
    core.debug(`Inputs: ${inspect(inputs)}`)

    const octokit = new github.GitHub(inputs.token)

    const projects = await getProjects(octokit, inputs.projectLocation)
    core.debug(`Projects: ${inspect(projects)}`)

    const project = getProject(
      projects,
      inputs.projectNumber,
      inputs.projectName
    )
    core.debug(`Project: ${inspect(project)}`)
    if (!project) throw 'No project matching the supplied inputs found.'

    const {data: columns} = await octokit.projects.listColumns({
      project_id: project['id']
    })
    core.debug(`Columns: ${inspect(columns)}`)

    const column = columns.find(column => column.name == inputs.columnName)
    core.debug(`Column: ${inspect(column)}`)
    if (!column) throw 'No column matching the supplied input found.'

    const content = await getContent(
      octokit,
      inputs.repository,
      inputs.issueNumber
    )
    core.debug(`Content: ${inspect(content)}`)

    const existingCard = await findCardInColumns(
      octokit,
      columns,
      content['url']
    )
    if (Object.keys(existingCard).length > 0) {
      core.debug(`Existing card: ${inspect(existingCard)}`)
      core.info(
        `An existing card is already associated with ${content['type']} #${inputs.issueNumber}`
      )
      core.setOutput('card-id', existingCard['id'])

      if (existingCard['column_url'] != column['url']) {
        core.info(`Moving card to column '${inputs.columnName}'`)
        await octokit.projects.moveCard({
          card_id: existingCard['id'],
          position: 'top',
          column_id: column['id']
        })
      }
    } else {
      core.info(
        `Creating card associated with ${content['type']} #${inputs.issueNumber}`
      )
      const {data: card} = await octokit.projects.createCard({
        column_id: column['id'],
        content_id: content['id'],
        content_type: content['type']
      })
      core.setOutput('card-id', card['id'])
    }
  } catch (error) {
    core.debug(inspect(error))
    core.setFailed(error.message)
  }
}

run()
