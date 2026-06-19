@echo off
setlocal

if "%npm_package_json%"=="" (
  echo npm_package_json is not set. Run this command through npm.
  exit /b 1
)

for %%I in ("%npm_package_json%") do set "REPO_ROOT=%%~dpI"
pushd "%REPO_ROOT%" || exit /b 1
%*
set "EXIT_CODE=%ERRORLEVEL%"
popd
exit /b %EXIT_CODE%
