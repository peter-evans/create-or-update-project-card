import * as core from '@actions/core'
import * as github from '@actions/github'
import {inspect} from 'util'

class Project {
  number: number
  name: string
  id: number
  constructor(number: number, name: string, id: number) {
    this.number = number
    this.name = name
    this.id = id
  }
}

class CardContent {
  id: number
  url: string
  type: string
  constructor(id: number, url: string, type: string) {
    this.id = id
    this.url = url
    this.type = type
  }
}

class Card {
  id: number
  columnUrl: string
  constructor(id: number, columnUrl: string) {
    this.id = id
    this.columnUrl = columnUrl
  }
}

async function isOrg(octokit, owner): Promise<boolean> {
  try {
    await octokit.rest.orgs.get({
      org: owner
    })
    return true
  } catch (error) {
    core.debug(inspect(error))
    return false
  }
}

async function getProjects(octokit, projectLocation): Promise<Project[]> {
  const [owner, repo] = projectLocation.split('/')
  const projects = await (async () => {
    if (repo) {
      return await octokit.paginate(octokit.rest.projects.listForRepo, {
        owner: owner,
        repo: repo,
        per_page: 100
      })
    } else if (await isOrg(octokit, owner)) {
      return await octokit.paginate(octokit.rest.projects.listForOrg, {
        org: owner,
        per_page: 100
      })
    } else {
      return await octokit.paginate(octokit.rest.projects.listForUser, {
        username: owner,
        per_page: 100
      })
    }
  })()
  core.debug(`Projects list: ${inspect(projects)}`)

  return projects.map(p => {
    return new Project(p.number, p.name, p.id)
  })
}

function getProject(
  projects: Project[],
  projectNumber,
  projectName
): Project | undefined {
  if (!isNaN(projectNumber) && projectNumber > 0) {
    return projects.find(project => project.number == projectNumber)
  } else if (projectName) {
    return projects.find(project => project.name == projectName)
  } else {
    throw 'A valid input for project-number OR project-name must be supplied.'
  }
}

async function getContent(
  octokit,
  repository,
  issueNumber
): Promise<CardContent> {
  const [owner, repo] = repository.split('/')
  const {data: issue} = await octokit.rest.issues.get({
    owner: owner,
    repo: repo,
    issue_number: issueNumber
  })
  core.debug(`Issue: ${inspect(issue)}`)
  if (!issue)
    throw 'No issue or pull request matching the supplied input found.'

  if (issue['pull_request']) {
    const {data: pull} = await octokit.rest.pulls.get({
      owner: owner,
      repo: repo,
      pull_number: issueNumber
    })
    return new CardContent(pull['id'], issue['url'], 'PullRequest')
  } else {
    return new CardContent(issue['id'], issue['url'], 'Issue')
  }
}

async function findCardInColumn(
  octokit,
  columnId,
  contentUrl,
  page = 1
): Promise<Card | undefined> {
  const perPage = 100
  const {data: cards} = await octokit.rest.projects.listCards({
    column_id: columnId,
    per_page: perPage,
    page: page
  })
  core.debug(`Cards: ${inspect(cards)}`)

  const card = cards.find(card => card.content_url == contentUrl)

  if (card) {
    return new Card(card.id, card.column_url)
  } else if (cards.length == perPage) {
    return findCardInColumn(octokit, columnId, contentUrl, ++page)
  } else {
    return undefined
  }
}

async function findCardInColumns(
  octokit,
  columns,
  contentUrl
): Promise<Card | undefined> {
  for (const column of columns) {
    const card = await findCardInColumn(octokit, column['id'], contentUrl)
    core.debug(`findCardInColumn: ${inspect(card)}`)
    if (card) {
      return card
    }
  }
  return undefined
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

    const octokit = github.getOctokit(inputs.token)

    const projects = await getProjects(octokit, inputs.projectLocation)
    core.debug(`Projects: ${inspect(projects)}`)

    const project = getProject(
      projects,
      inputs.projectNumber,
      inputs.projectName
    )
    core.debug(`Project: ${inspect(project)}`)
    if (!project) throw 'No project matching the supplied inputs found.'

    const columns = await octokit.paginate(octokit.rest.projects.listColumns, {
      project_id: project.id,
      per_page: 100
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

    const existingCard = await findCardInColumns(octokit, columns, content.url)
    if (existingCard) {
      core.debug(`Existing card: ${inspect(existingCard)}`)
      core.info(
        `An existing card is already associated with ${content.type} #${inputs.issueNumber}`
      )
      core.setOutput('card-id', existingCard.id)

      if (existingCard.columnUrl != column.url) {
        core.info(`Moving card to column '${inputs.columnName}'`)
        await octokit.rest.projects.moveCard({
          card_id: existingCard.id,
          position: 'top',
          column_id: column.id
        })
      }
    } else {
      core.info(
        `Creating card associated with ${content.type} #${inputs.issueNumber}`
      )
      const {data: card} = await octokit.rest.projects.createCard({
        column_id: column.id,
        content_id: content.id,
        content_type: content.type
      })
      core.setOutput('card-id', card.id)
    }
  } catch (error: any) {
    core.debug(inspect(error))
    core.setFailed(error.message)
  }
}

run()
