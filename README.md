# Gestão de Frotas

Aplicação web progressiva (PWA) para cadastro e vistoria de veículos. Nome exibido na interface: **VistoriaFrotas**.

## Versão atual

**0.2.0**

Esta primeira entrega estabelece a fundação do projeto:
- Interface responsiva com abordagem mobile-first.
- Navegação entre os módulos principais.
- Cadastro, listagem, busca e exclusão de veículos.
- Persistência local com IndexedDB.
- Exportação e restauração de backup em JSON, incluindo fotos anexadas às vistorias.
- Registro de vistorias com motorista, vistoriador, quilometragem e data.
- Checklist por categoria com estados Conforme, Avaria e Não verificado.
- Observações e fotografias por item do checklist.
- Histórico e consulta detalhada das vistorias.
- Estrutura inicial de PWA e cache offline.

Os módulos de vistorias, histórico e relatórios estão identificados na interface, mas ainda serão implementados nas próximas etapas.

## Tecnologias

- HTML5
- CSS3
- JavaScript com ES Modules
- IndexedDB
- Service Worker e Web App Manifest

Não há processo de build nem dependências obrigatórias.

## Como executar localmente

O projeto utiliza módulos JavaScript e IndexedDB. Por isso, abra-o por um servidor HTTP local, não diretamente pelo endereço `file://`.

Com Python instalado, execute na pasta do projeto:

```bash
python3 -m http.server 8000
```

Depois acesse:

```text
http://localhost:8000
```

Também é possível utilizar a extensão Live Server do Visual Studio Code.

## Publicar no GitHub Pages

1. Crie o repositório `gestao-frotas` no GitHub.
2. Envie todos os arquivos e pastas deste projeto para a raiz do repositório.
3. No GitHub, abra **Settings > Pages**.
4. Em **Build and deployment**, selecione **Deploy from a branch**.
5. Escolha a branch `main` e a pasta `/ (root)`.
6. Salve e aguarde a publicação.

O GitHub Pages fornece HTTPS, necessário para instalação PWA e funcionamento do Service Worker.

## Armazenamento e privacidade

Os dados são mantidos no IndexedDB do navegador e ficam vinculados ao navegador e à instalação utilizados. Nesta versão não existe servidor, conta de usuário ou sincronização entre dispositivos.

**Atenção:** limpar os dados do navegador pode apagar os registros. Exporte backups regularmente e mantenha cópias em local seguro.

## Estrutura

```text
gestao-frotas/
├── index.html
├── manifest.json
├── sw.js
├── README.md
└── assets/
    ├── css/
    │   └── style.css
    ├── images/
    │   └── icon.svg
    └── js/
        ├── app.js
        ├── database/
        │   └── database.js
        ├── modules/
        │   ├── backup.js
        │   └── vehicles.js
        └── utils/
            └── helpers.js
```

## Próximas etapas

- 0.2: concluído. Formulário de vistoria, checklist e fotografias.
- 0.3: filtros avançados e relatórios PDF.
- 0.4: aprimoramento do backup, validações e testes em dispositivos.
- Futuro: configurações por unidade, personalização e sincronização opcional.

## Licença

Ainda não definida.
