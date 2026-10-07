@echo off
setlocal EnableExtensions DisableDelayedExpansion
cd /d "%~dp0"

echo Source AI - GitHub setup
echo.

where git >nul 2>nul
if errorlevel 1 goto :no_git
if not exist "index.html" goto :no_project

if not exist ".git" (
  echo Initializing the Git repository...
  git init
  if errorlevel 1 goto :failed
)

git branch -M main
if errorlevel 1 goto :failed

git config --get user.name >nul 2>nul
if errorlevel 1 goto :ask_name
goto :name_ready

:ask_name
set /p GIT_USER_NAME=Enter your Git commit name: 
if not defined GIT_USER_NAME goto :failed
git config user.name "%GIT_USER_NAME%"
if errorlevel 1 goto :failed

:name_ready
git config --get user.email >nul 2>nul
if errorlevel 1 goto :ask_email
goto :email_ready

:ask_email
set /p GIT_USER_EMAIL=Enter your Git commit email: 
if not defined GIT_USER_EMAIL goto :failed
git config user.email "%GIT_USER_EMAIL%"
if errorlevel 1 goto :failed

:email_ready
echo.
set /p REPO_URL=Enter your empty GitHub repository URL: 
if not defined REPO_URL goto :failed

git remote get-url origin >nul 2>nul
if errorlevel 1 goto :add_remote
for /f "delims=" %%U in ('git remote get-url origin 2^>nul') do set "CURRENT_ORIGIN=%%U"
if /i "%CURRENT_ORIGIN%"=="%REPO_URL%" goto :origin_ready

echo.
echo The existing origin is: %CURRENT_ORIGIN%
choice /c YN /m "Replace it with the URL you entered"
if errorlevel 2 goto :cancelled
git remote set-url origin "%REPO_URL%"
if errorlevel 1 goto :failed
goto :origin_ready

:add_remote
git remote add origin "%REPO_URL%"
if errorlevel 1 goto :failed

:origin_ready
echo.
echo Adding project files...
git add -A
if errorlevel 1 goto :failed

git diff --cached --quiet
if errorlevel 1 (
  git commit -m "Initial Source AI"
  if errorlevel 1 goto :failed
) else (
  echo No new changes to commit.
)

echo.
echo Pushing the main branch to GitHub...
git push -u origin main
if errorlevel 1 goto :push_failed

echo.
echo Success. Your project is now on GitHub.
echo Next: Import this repository in Vercel, set GeminiAPI1 and GeminiAPI2 as Secret values, then deploy.
echo Push future updates to the main branch to trigger a production deployment.
pause
exit /b 0

:no_git
echo ERROR: Git was not found. Install Git for Windows, then run this file again.
goto :finish

:no_project
echo ERROR: index.html was not found. Extract this ZIP, then run the BAT file from the extracted folder.
goto :finish

:push_failed
echo ERROR: GitHub push failed. Check the repository URL, GitHub sign-in, and repository permissions.
echo If the remote repository is not empty, review its contents before retrying. Do not force-push.
goto :finish

:cancelled
echo Cancelled. The existing origin was not changed.
goto :finish

:failed
echo ERROR: A Git command failed. Read the message above, fix the issue, and run this file again.

:finish
pause
exit /b 1
