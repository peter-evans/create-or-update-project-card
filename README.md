# Create or Update Project Card
[![CI](https://github.com/peter-evans/create-or-update-project-card/workflows/CI/badge.svg)](https://github.com/peter-evans/create-or-update-project-card/actions?query=workflow%3ACI)
[![GitHub Marketplace](https://img.shields.io/badge/Marketplace-Create%20or%20Update%20Project%20Card-blue.svg?colorA=24292e&colorB=0366d6&style=flat&longCache=true&logo=data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAA4AAAAOCAYAAAAfSC3RAAAABHNCSVQICAgIfAhkiAAAAAlwSFlzAAAM6wAADOsB5dZE0gAAABl0RVh0U29mdHdhcmUAd3d3Lmlua3NjYXBlLm9yZ5vuPBoAAAERSURBVCiRhZG/SsMxFEZPfsVJ61jbxaF0cRQRcRJ9hlYn30IHN/+9iquDCOIsblIrOjqKgy5aKoJQj4O3EEtbPwhJbr6Te28CmdSKeqzeqr0YbfVIrTBKakvtOl5dtTkK+v4HfA9PEyBFCY9AGVgCBLaBp1jPAyfAJ/AAdIEG0dNAiyP7+K1qIfMdonZic6+WJoBJvQlvuwDqcXadUuqPA1NKAlexbRTAIMvMOCjTbMwl1LtI/6KWJ5Q6rT6Ht1MA58AX8Apcqqt5r2qhrgAXQC3CZ6i1+KMd9TRu3MvA3aH/fFPnBodb6oe6HM8+lYHrGdRXW8M9bMZtPXUji69lmf5Cmamq7quNLFZXD9Rq7v0Bpc1o/tp0fisAAAAASUVORK5CYII=)](https://github.com/marketplace/actions/create-or-update-project-card)

A GitHub action to create or update a project card.

## Usage

### Create a project card

```yml
      - name: Create or Update Project Card
        uses: peter-evans/create-or-update-project-card@v1
        with:
          project-name: My project
          column-name: My column
          issue-number: 1
```

### Update a project card

If a card already exists in project `My project` for issue `1`, the action will check if the card is in column `My second column`.
If not in the specified column, the action will move the card.

```yml
      - name: Create or Update Project Card
        uses: peter-evans/create-or-update-project-card@v1
        with:
          project-name: My project
          column-name: My second column
          issue-number: 1
```

### Create a card for all new issues

```yml
on:
  issues:
    types: [opened]
jobs:
  createCard:
    runs-on: ubuntu-latest
    steps:
      - name: Create or Update Project Card
        uses: peter-evans/create-or-update-project-card@v1
        with:
          project-name: My project
          column-name: My column
```

### Create a card for all new pull requests

Note: Does not work for pull requests from repository forks.

```yml
on:
  pull_request:
    types: [opened]
jobs:
  createCard:
    runs-on: ubuntu-latest
    steps:
      - name: Create or Update Project Card
        uses: peter-evans/create-or-update-project-card@v1
        with:
          project-name: My project
          column-name: My column
          issue-number: ${{ github.event.number }}
```

### Action inputs

| Name | Description | Default |
| --- | --- | --- |
| `token` | `GITHUB_TOKEN` or a `repo` scoped [PAT](https://help.github.com/en/github/authenticating-to-github/creating-a-personal-access-token-for-the-command-line). | `GITHUB_TOKEN` |
| `project-number` | (**semi-required**) The number of the project. Either `project-number` OR `project-name` must be supplied. | |
| `project-name` | (**semi-required**) The name of the project. Either `project-number` OR `project-name` must be supplied. Note that a project's name is not unique. The action will use the first matching project found. | |
| `column-name` | (**required**) The name of the column to add a card to, or move an existing card to. | |
| `repository` | The GitHub repository containing the issue or pull request. | `github.repository` (current repository) |
| `issue-number` | The issue or pull request number to associate with the card. | `github.event.issue.number` |

### Action outputs

The action outputs `card-id` for use in later workflow steps.

```yml
      - name: Create or Update Project Card
        id: coupc
        uses: peter-evans/create-or-update-project-card@v1
        with:
          project-name: My project
          column-name: My column
          issue-number: 1
      - name: Check output
        run: echo ${{ steps.coupc.outputs.card-id }}
```

## License

[MIT](LICENSE)
