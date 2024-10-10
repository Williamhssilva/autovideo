# AutoVideo

AutoVideo é uma aplicação web que automatiza o processo de adição de legendas em vídeos. Utilizando tecnologias de reconhecimento de fala e processamento de vídeo, o AutoVideo transcreve o áudio do vídeo e adiciona as legendas correspondentes.

## Funcionalidades

- Upload de vídeos
- Extração de áudio do vídeo
- Transcrição do áudio para texto
- Segmentação do vídeo
- Adição de legendas aos segmentos de vídeo
- Visualização do vídeo processado com legendas

## Tecnologias Utilizadas

- Backend: Node.js, Express.js
- Frontend: React.js
- Banco de Dados: MongoDB
- Processamento de Vídeo: FFmpeg
- Reconhecimento de Fala: Google Cloud Speech-to-Text API

## Pré-requisitos

- Node.js (versão 14 ou superior)
- MongoDB
- FFmpeg

## Instalação

1. Clone o repositório:
   ```
   git clone https://github.com/Williamhssilva/autovideo.git
   cd autovideo
   ```

2. Instale as dependências do backend:
   ```
   cd backend
   npm install
   ```

3. Instale as dependências do frontend:
   ```
   cd ../frontend
   npm install
   ```

4. Configure as variáveis de ambiente:
   Crie um arquivo `.env` na pasta `backend` com as seguintes variáveis:
   ```
   MONGODB_URI=sua_uri_do_mongodb
   GOOGLE_CLOUD_API_KEY=sua_chave_api_do_google_cloud
   ```

## Executando o Projeto

1. Inicie o servidor backend:
   ```
   cd backend
   npm start
   ```

2. Execute o arquivo upload_test.html com algum srevidor frontend.

3. Acesse a aplicação em seu navegador: `http://localhost:3000`

## Contribuindo

Contribuições são bem-vindas! Por favor, leia as diretrizes de contribuição antes de submeter pull requests.

## Licença

Este projeto está licenciado sob a Licença MIT - veja o arquivo [LICENSE.md](LICENSE.md) para detalhes.

## Contato

Seu Nome - [williamhss90@gmail.com](mailto:williamhss90@gmail.com)

Link do Projeto: [https://github.com/Williamhssilva/autovideo](https://github.com/Williamhssilva/autovideo)
