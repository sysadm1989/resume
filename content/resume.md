# Алексей Назаров

**Tech Lead — DevOps / Platform Engineer** · Kubernetes · GitOps · Helm · CI/CD

Москва, м. Преображенская площадь · на месте / гибрид · редкие командировки  
📧 sysadm1989@gmail.com · 📱 +7 (917) 534-44-35 · 💬 Telegram: @alexnazarov89  
Гражданство: РФ · опыт: 17+ лет

---

## Профиль

Руководитель направления DevOps и контейнеризации с фокусом на **Kubernetes**, **GitOps**, **CI/CD** и платформенные сервисы.
Строю и сопровождаю коммунальную инфраструктуру для продуктовых команд: кластеры (**ванильный Kubernetes** и **Deckhouse**), **Keycloak** (identity), **Vault** (секреты), артефакты, автоматизацию и IDP.
Единый **RBAC** по платформенным системам: роли и доступы согласованы между Keycloak, Kubernetes, GitLab, Vault, AWX и смежными сервисами.

Сильные стороны: **внедрение GitOps-платформы под ключ**, наставничество инженеров, единые стандарты delivery, отказоустойчивые архитектуры, IaC и безопасный доступ через merge request.

---

## Ключевые навыки

### Kubernetes & Platform
- **Kubernetes** (ванильный и bare-metal / on-premise): Cilium, Istio, Falco/Kyverno, MetalLB, cert-manager
- **Deckhouse**: bootstrap и эксплуатация платформенного кластера, ModuleConfig, Project/AppProject, Secrets Store CSI, admission-policy-engine, operator-trivy, SDS/replicated volume
- Tenancy и политики: **Capsule**, Kyverno; runtime security
- **Helm**: платформенные и продуктовые чарты, values по окружениям, canary (Istio VS/DR), **VPA**
- GitOps: Argo CD (AppProjects, bootstrap Applications)
- Observability: **OpenTelemetry**, **VictoriaMetrics** (vmagent/vmalert/vmauth), **VictoriaLogs**, Vector, Grafana, Alertmanager
- Networking / TLS: Istio, **MetalLB**, **cert-manager**, ExternalDNS
- Storage: **Linstor**, Local, S3
- Canary deploy: Istio в Kubernetes, nginx+lua на серверах
- Platform-сервисы для команд: **Keycloak** (SSO/RBAC), **Vault** (коммунальный secrets + CSI в поды), Nexus, AWX, Sentry
- Секреты в workloads: Deckhouse **Secrets Store CSI** / External Secrets → Vault KV
- **RBAC** end-to-end: Keycloak / FreeIPA / LDAP / OIDC → Kubernetes, GitLab, Vault, AWX
- Опыт написания оператора для Kubernetes

### CI/CD & Automation
- GitLab / **GitLab CI Components**: единые шаблоны (prepare → test → **Kaniko** → SCA → deploy Argo CD)
- Сборка образов Kaniko; публикация в Nexus / Yandex Container Registry
- Ansible / AWX, IaC; **Vault IaC** (KV mounts, policies, FreeIPA/LDAP/OIDC groups из state YAML)
- HA PostgreSQL: **Patroni** + etcd + PostgreSQL (Ansible)
- Python / Django (IDP: git flow, релиз-манифест), Bash; интеграция REST API

### Cloud & Infra
- Yandex Cloud: Container Registry, **Object Storage** (IaC бакетов под сервисы платформы)
- Linux (CentOS / Ubuntu / RHEL-подобные), **Docker**, **Podman** (rootful / rootless)
- Виртуализация и bare-metal

### Практики
- Единый **RBAC** и ролевой доступ в сервисы через merge request
- Проектирование HA / резервирование
- Развитие IDP (портал разработчика): git flow, релиз-манифест
- Наставничество и руководство командой

---

## Опыт

### Руководитель направления DevOps и контейнеризации — ООО «Финтех-платформа»
**Март 2025 — н.в.** · Москва

- Внедрение **полной DevOps/GitOps-платформы под ключ**: Kubernetes, CI/CD, IaC, коммунальные сервисы и единые стандарты для продуктовых команд.
- **Keycloak** как коммунальный сервис identity: SSO, роли и доступ продуктовых команд к платформе и инструментам; **realm как сервис** с LDAP и Kerberos.
- **Vault** как коммунальный сервис секретов: KV, политики, выдача credentials; интеграция в поды через Deckhouse Secrets Store CSI.
- **Vault IaC**: декларативный доступ (state YAML) → policies + FreeIPA/LDAP/OIDC groups, без ручной настройки в UI.
- Единый **RBAC по всем системам** платформы: Keycloak / FreeIPA → Kubernetes, GitLab, Vault, AWX.
- Единые **GitLab CI Components** для команд: prepare → test → Kaniko → SCA → deploy в Argo CD.
- Наставничество и руководство командой инженеров: обучение Kubernetes, CI/CD, IaC.
- Развитие и сопровождение коммунальных сервисов: Kubernetes, Vault, Nexus, AWX, Keycloak, GitLab, Sentry.
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
- Администрирование Yandex Cloud: Container Registry, **Object Storage** (бакеты под платёжные сервисы, IaC).

### Начальник отдела infra devops — АО «НСПК»
**Январь 2016 — Март 2025** · Москва · [nspk.ru](https://www.nspk.ru)

- Руководство отделом infra devops: планирование, приоритизация, развитие платформы и автоматизации.
- Развитие и сопровождение **ванильного Kubernetes** on-premise: **Capsule**, **cert-manager**, **Tetragon**, **Kyverno**, **Linstor**; собственные шаблоны управления кластером и коммунальными компонентами.
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
- Опыт разработки на Django и интеграции REST API; написание оператора для Kubernetes.
- Формирование и закрепление единого стандарта разработки и CI/CD: onboarding команд на платформу, документация, self-service через IDP (git flow, релиз-манифест).
- Сильный ops-фундамент: ЦОД и инфраструктура «с нуля», HA (в т.ч. Patroni), мониторинг, безопасность и эксплуатация в регулируемых средах.

---

## Стек (кратко)

`Kubernetes` `Deckhouse` `Helm` `Istio` `Cilium` `Capsule` `Tetragon` `Argo CD`  
`GitLab CI` `Kaniko` `OpenTelemetry` `VictoriaMetrics` `VictoriaLogs` `Vector`  
`Ansible` `AWX` `Vault` `Keycloak` `FreeIPA` `Nexus` `Patroni` `Sentry`  
`MetalLB` `cert-manager` `Linstor` `External Secrets` `Yandex Cloud`  
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

## Языки

- Русский — родной
- Английский — B2 (средне-продвинутый)

---

## Как со мной работать

Предпочитаю GitOps, IaC и ревьюемые изменения через MR.  
Для оценки вакансии приложите текст, PDF или ссылку — на сайте есть сравнение с профилем кандидата.