# AttackPilot 演示数据

该目录保存可直接恢复的 PostgreSQL 与 Redis 数据：

- `demo-data/attackpilot-postgres.dump`：任务、状态、报告和日志索引。
- `demo-data/attackpilot-redis-data.tar.gz`：完整日志正文及 Redis 持久化数据。

在后端 `docker-compose.yml` 所在目录执行：

```powershell
..\TracePilot-dashboard\deployment\import-demo-data.ps1 -ComposeDirectory .
```

脚本会覆盖当前 Docker 中的 PostgreSQL 和 Redis 数据。请在新部署环境使用，已有重要数据时先备份。
