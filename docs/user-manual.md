# GradeLogic User Manual

## Login and roles

Use `/api/v1/auth/login` to get JWT token:

- `admin@gradelogic.local / admin123`
- `teacher@gradelogic.local / teacher123`
- `student@gradelogic.local / student123`

Store token in browser localStorage key `gl_token` for inline editing in UI.

## Main workflows

- Use filters on main page to build report.
- Open student modal by row click.
- Use `Ctrl+K` for quick student search.
- Double click grade value in modal to edit (teacher/admin with JWT).

## API docs

Open Swagger UI at `/api/v1/docs`.

## Import CSV

Send multipart form-data to `/api/v1/grades/import`:

- `file`: CSV file
- `dryRun`: `true|false`

CSV columns:

`studentId,subject,value,semester,attendedLessons,totalLessons`
