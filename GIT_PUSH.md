# Команды для загрузки на GitHub

Выполните эти команды в PowerShell (в папке проекта):

```powershell
# Настройка git
git config user.email "razdet4-spec@users.noreply.github.com"
git config user.name "razdet4-spec"

# Добавление файлов
git add .

# Создание коммита
git commit -m "Initial commit - LynchFM Radio Station"

# Push на GitHub (используя токен)
# ВАЖНО: Замените YOUR_TOKEN на ваш токен из GitHub!
git push https://YOUR_TOKEN@github.com/razdet4-spec/lynchfm.git main
```

Или просто запустите файл `push-to-github.bat` двойным кликом!

