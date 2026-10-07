@echo off
setlocal DisableDelayedExpansion
cd /d "%~dp0"

echo Source AI - Vercel routing fix
echo.

where git >nul 2>nul
if errorlevel 1 goto :no_git
if not exist ".git" goto :not_repo
if not exist "index.html" goto :missing_files
if not exist "preview-server.cjs" goto :missing_files
findstr /c:"preview-server.cjs" package.json >nul
if errorlevel 1 goto :missing_files
findstr /c:"outputDirectory" vercel.json >nul
if errorlevel 1 goto :missing_files

if exist "server.js" (
  echo Removing the old Vercel server entrypoint...
  del /f /q "server.js"
  if exist "server.js" goto :failed
)

echo Staging the Vercel routing fix...
git add -A
if errorlevel 1 goto :failed

git diff --cached --quiet
if errorlevel 1 (
  git commit -m "Fix Vercel static routing"
  if errorlevel 1 goto :failed
) else (
  echo No pending changes were found.
)

echo.
echo Pushing the fix to GitHub...
git push -u origin main
if errorlevel 1 goto :push_failed

echo.
echo Success. Vercel should start a new deployment from the main branch.
echo Check the deployment status in your Vercel project dashboard.
pause
exit /b 0

:no_git
echo ERROR: Git was not found. Install Git for Windows, then try again.
goto :finish

:not_repo
echo ERROR: This folder is not a Git repository. Run this in your existing project folder.
goto :finish

:missing_files
echo ERROR: Updated project files are missing.
echo Extract the updated ZIP over this existing project folder, then run this file again.
echo Keep the existing .git folder when extracting the ZIP.
goto :finish

:push_failed
echo ERROR: Push failed. Check the origin URL, GitHub sign-in, and repository permissions.
echo Do not force-push. Review the GitHub repository if it contains unexpected commits.
goto :finish

:failed
echo ERROR: A Git command failed. Read the message above and fix the issue.

:finish
pause
exit /b 1
