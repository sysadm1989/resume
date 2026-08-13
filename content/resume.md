# Алексей Назаров

**Tech Lead — DevOps / Platform Engineer** · Kubernetes · GitOps · Helm · CI/CD

Москва · на месте / гибрид · редкие командировки  
📧 sysadm1989@gmail.com · 📱 +7 (917) 534-44-35 · 💬 Telegram: @alexnazarov89 · [Habr](https://habr.com/ru/users/sysadm1989/) · [LinkedIn](https://ru.linkedin.com/in/aleksey-nazarov-451593113)  
Гражданство: РФ · опыт: 17+ лет

---

## Профиль

Руководитель направления DevOps и контейнеризации с фокусом на **Kubernetes**, **GitOps**, **CI/CD** и платформенные сервисы.
Строю и сопровождаю коммунальную инфраструктуру для продуктовых команд: кластеры (**ванильный Kubernetes** и **Deckhouse**), **Keycloak** (SSO), **Vault** (секреты), **Nexus/Harbor** (артефакты), автоматизацию и **IDP** (git flow, релиз-манифест, self-service для команд).
Единый **RBAC** по платформенным системам: роли и доступы согласованы между Keycloak, Kubernetes, GitLab, Vault, AWX и смежными сервисами.

Сильные стороны: **внедрение GitOps-платформы под ключ**, наставничество инженеров, единые стандарты CI/CD, отказоустойчивые архитектуры, IaC.

---

## Ключевые навыки

### Kubernetes & Platform
- **Администрирование Kubernetes** (ванильный, bare-metal / on-premise и **Deckhouse**): bootstrap, обновления control-plane/worker, сеть, storage, RBAC, аддоны (Cilium, Istio, Falco/Kyverno, MetalLB, cert-manager); Deckhouse: multitenancy-manager, Secrets Store CSI, admission-policy-engine, operator-trivy
- Tenancy и политики: **Capsule**, Kyverno; runtime security
- **Helm**: платформенные и продуктовые чарты, values по окружениям, canary (Istio VS/DR), **VPA**
- GitOps: Argo CD (AppProjects, bootstrap Applications)
- Observability: **OpenTelemetry**, **VictoriaMetrics**, **VictoriaLogs**, Vector, Grafana, Alertmanager
- Networking / TLS: Istio, **MetalLB**, **cert-manager**, ExternalDNS, **PowerDNS**
- Storage: **Linstor**, Local, S3, **SeaweedFS**
- Canary deploy: Istio в Kubernetes, nginx+lua на серверах
- Platform-сервисы для команд: Keycloak, Vault, Nexus, AWX, Sentry
- DNS: настройка и администрирование **PowerDNS** (зоны, записи, интеграция с ExternalDNS)
- Object storage: настройка и администрирование **SeaweedFS** (S3 API, тома, репликация, эксплуатация)
- Векторная БД: настройка и администрирование **Qdrant** (коллекции, персистентность, бэкапы, доступ)
- Секреты в workloads: Deckhouse **Secrets Store CSI** / External Secrets → Vault KV
- **RBAC** end-to-end: Keycloak / FreeIPA / LDAP / OIDC → Kubernetes, GitLab, Vault, AWX
- Опыт написания оператора для Kubernetes

### CI/CD & Automation
- GitLab / **GitLab CI Components**: единые шаблоны/компоненты (prepare → test → **Kaniko** → SCA → deploy Argo CD)
- Сборка образов Kaniko; публикация в Nexus / Yandex Container Registry
- Ansible / AWX, IaC; **Vault IaC** (KV mounts, policies, FreeIPA/LDAP/OIDC groups из state YAML)
- HA PostgreSQL: **Patroni** + etcd + PostgreSQL (Ansible)
- Python / Django (IDP: git flow, релиз-манифест), интеграция REST API

### Cloud & Infra
- Yandex Cloud: Container Registry, **Object Storage** (IaC бакетов под сервисы платформы)
- Linux (CentOS / Ubuntu / RHEL-подобные), **Docker**, **Podman** (rootful / rootless)
- Виртуализация и bare-metal

### Практики
- Единый **RBAC** и ролевой доступ в сервисы через MR
- Проектирование HA / резервирование
- Развитие IDP (портал разработчика): git flow, релиз-манифест
- Наставничество и руководство командой

---

## Опыт

### Руководитель направления DevOps и контейнеризации — ООО «Финтех-платформа»
**Март 2025 — н.в.** · Москва

- Внедрение **полной DevOps/GitOps-платформы под ключ**: Kubernetes, CI/CD, IaC, коммунальные сервисы и единые стандарты для продуктовых команд.
- **Администрирование Kubernetes**: bootstrap и обновление кластеров, control-plane/worker, сеть (Cilium/Istio/MetalLB), storage, RBAC, аддоны; эксплуатация **ванильного Kubernetes** и **Deckhouse**.
- **Keycloak** как коммунальный сервис identity: SSO, роли и доступ продуктовых команд к платформе и инструментам; **realm как сервис** с LDAP и Kerberos.
- **Vault** как коммунальный сервис секретов: KV, политики, выдача credentials; интеграция в поды через Deckhouse Secrets Store CSI.
- **Vault IaC**: декларативный доступ (state YAML) → policies + FreeIPA/LDAP/OIDC groups, без ручной настройки в UI.
- Единый **RBAC по всем системам** платформы: Keycloak / FreeIPA → Kubernetes, GitLab, Vault, AWX.
- Единые **GitLab CI Components** для команд: prepare → test → Kaniko → SCA → deploy в Argo CD.
- Наставничество и руководство командой инженеров: обучение Kubernetes, CI/CD, IaC.
- Развитие и сопровождение коммунальных сервисов: Kubernetes, Vault, Nexus, AWX, Keycloak, GitLab, Sentry.
- Настройка и администрирование **Qdrant** (векторная БД): развёртывание, коллекции, персистентность, бэкапы и эксплуатация как платформенного сервиса.
- Настройка и администрирование **SeaweedFS**: S3-совместимое object storage, тома и репликация, эксплуатация как платформенного сервиса.
- Настройка и администрирование **PowerDNS**: зоны и записи, интеграция с Kubernetes через ExternalDNS.
- Observability-контур: OpenTelemetry, VictoriaMetrics, VictoriaLogs, Vector, Grafana, Alertmanager.
- IaC на Ansible (в т.ч. HA PostgreSQL на Patroni), CI/CD на GitLab, GitOps на Argo CD.
- **Helm**-чарты для коммунальных и продуктовых сервисов (canary, VPA); GitOps на Argo CD.
- **Deckhouse**: bootstrap кластеров, модули платформы (Secrets Store CSI, admission-policy, trivy, SDS), эксплуатация «под ключ».
- Опыт и **ванильного Kubernetes** (bare-metal: Cilium, Istio и др.), и платформенного контура на Deckhouse.
- Addons: **Falco**, **MetalLB**, **cert-manager**, External Secrets, Reloader, ExternalDNS.
- Storage: **Linstor**; security: Kyverno, **operator-trivy**.
- Canary deploy (Istio VS/DR, nginx+lua на серверах).
- Разработка и сопровождение IDP (портал разработчика на Django + Keycloak OIDC): git flow, релиз-манифест для команд.
- Проектирование отказоустойчивых архитектур с высокой доступностью и резервированием.
- Администрирование Yandex Cloud: Container Registry, **Object Storage** (бакеты под сервисы, IaC).

### Начальник отдела infra devops — АО «НСПК»
**Январь 2016 — Март 2025** · Москва · [nspk.ru](https://www.nspk.ru)

- Руководство отделом infra devops: планирование, приоритизация, развитие платформы и автоматизации.
- **Администрирование ванильного Kubernetes** on-premise: bootstrap, обновления, **Capsule**, **cert-manager**, **Tetragon**, **Kyverno**, **Linstor**; собственные шаблоны управления кластером и коммунальными компонентами.
- **Namespace как сервис** для продуктовых команд.
- Деплой и обновление кластера через **Ansible**.
- Разработка и сопровождение внутренних систем автоматизации (Python / Django).
- Коммунальные сервисы для команд: **AWX**, **Vault**, **Nexus**; единая ролевая модель

### Системный администратор — ООО «Внешпромбанк»
**Сентябрь 2011 — Декабрь 2015** · Москва

- Работа в ЦОД с момента внедрения: коммутация, монтаж, настройка сетевого и серверного оборудования.
- Мониторинг (Zabbix); СХД EMC VNX / HP MSA; виртуализация qemu-kvm и Oracle VM.
- «Горячий» бэкап и архивация ВМ (shell / virsh).
- RHEL-подобные серверы: bonding, multipathing, OCFS2, nginx, Pacemaker.
- Централизованная конфигурация (Puppet Enterprise), манифесты.
- Соответствие PCI-DSS; FreeIPA; Kaspersky Security Center.

---

## Дополнительно обо мне

- Выстроил и ввёл в эксплуатацию **полную платформу DevOps**: Kubernetes, GitOps (Argo CD), **GitLab CI Components** + Kaniko, IaC, **Vault** (+ CSI в поды), **Keycloak/FreeIPA**, observability (OTel / VictoriaMetrics / VictoriaLogs), IDP — единый контур для продуктовых команд.
- Внедряю **GitOps под ключ**: bootstrap кластера (**Deckhouse** или ванильный Kubernetes), Argo CD, **Helm**-шаблоны приложений (canary, VPA), политики и изменения через merge request.
- Эксплуатирую **Qdrant** как векторное хранилище; тестировал **RAG** над корпоративной wiki (чанкинг документации → эмбеддинги → semantic retrieval, проверка релевантности ответов с цитированием источников).
- Опыт разработки на Django и интеграции REST API; написание оператора для Kubernetes.
- Формирование и закрепление единого стандарта разработки и CI/CD: onboarding команд на платформу, документация, self-service через IDP (git flow, релиз-манифест).
- Сильный ops-фундамент: ЦОД и инфраструктура «с нуля», HA (в т.ч. Patroni), мониторинг, безопасность и эксплуатация в регулируемых средах.

---

## Стек (кратко)

`Kubernetes` `Deckhouse` `Helm` `Istio` `Cilium` `Capsule` `Tetragon` `Argo CD`  
`GitLab CI` `Kaniko` `OpenTelemetry` `VictoriaMetrics` `VictoriaLogs` `Vector`  
`Ansible` `AWX` `Vault` `Keycloak` `FreeIPA` `Nexus` `Patroni` `Sentry`  
`Qdrant` `SeaweedFS` `PowerDNS` `MetalLB` `cert-manager` `Linstor` `External Secrets` `Yandex Cloud`  
`Docker` `Podman` `Linux` `Python` `Django` `Bash`

---

## Образование

- **2014** — высшее, МГУПИ · ИТ7, Автоматизированные системы обработки информации и управления
- **2009** — среднее специальное, МГКИЭТ · 230105, ПО вычислительной техники и автоматизированных систем

---

## Курсы и сертификаты

- **2019** — Инвента / НСПК: RH300, RH342, RH442; RHCSA
- **2010** — MCP, MCSA (Windows Server 2003); комплексная защита КИ; АПКШ «Континент»

---

## Публикации и выступления

- **2023** — [Kubernetes в Мир Plat.Form](https://www.youtube.com/watch?v=HZXz5guN6R0) — TechTalk, HighLoad++ 2023
- **2022** — [Kubernetes в НСПК](https://habr.com/ru/companies/nspk/articles/668578/) — Habr
- **2020** — [Как мы автоматизировали весь жизненный цикл серверов](https://habr.com/ru/companies/nspk/articles/511062/) — Habr

---

## Языки

- Русский — родной
- Английский — B2 (средне-продвинутый)

---

## Как со мной работать

Перед звонком лучше проверить вакансию на сайте: вставьте текст, PDF или ссылку — будет видно насколько я подхожу.

Если совпадение хорошее — пишите в Telegram или звоните, контакты выше.