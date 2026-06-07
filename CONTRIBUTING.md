# Contributing to AutoPro Garage Management

First off, thank you for considering contributing to AutoPro Garage Management. It's people like you that make this tool such a great project.

## 1. Where do I go from here?

If you've noticed a bug or have a feature request, make one! It's generally best if you get confirmation of your bug or approval for your feature request this way before starting to code.

## 2. Fork & create a branch

If this is something you think you can fix, then fork AutoPro Garage Management and create a branch with a descriptive name.

A good branch name would be (where issue #325 is the ticket you're working on):

```sh
git checkout -b 325-add-vehicle-search
```

## 3. Implement your fix or feature

At this point, you're ready to make your changes. Feel free to ask for help; everyone is a beginner at first.

## 4. Make a Pull Request

At this point, you should switch back to your master branch and make sure it's up to date with AutoPro Garage Management's master branch:

```sh
git remote add upstream git@github.com:USERNAME/Garagecar.git
git checkout master
git pull upstream master
```

Then update your feature branch from your local copy of master, and push it!

```sh
git checkout 325-add-vehicle-search
git rebase master
git push --set-upstream origin 325-add-vehicle-search
```

Finally, go to GitHub and make a Pull Request.

## 5. Keeping your Pull Request updated

If a maintainer asks you to "rebase" your PR, they're saying that a lot of code has changed, and that you need to update your branch so it's easier to merge.

## Coding style

- Backend uses standard Node.js (Express + SQLite). Ensure responses follow the standardized `sendSuccess` and `sendError` helpers.
- Frontend uses Vanilla JavaScript, HTML5, and standard CSS3. No build tools are required for the frontend.
- Please comment your code and keep it clean and readable.

Thank you!
