# Rastreio Fácil

Rastreio Fácil é um aplicativo de rastreamento veicular desenvolvido com React Native e Expo. Este aplicativo permite que os usuários rastreiem a localização de veículos em tempo real e gerenciem solicitações de acesso.

## Funcionalidades

- **Rastreamento em Tempo Real**: Monitore a localização dos veículos em tempo real.
- **Gerenciamento de Solicitações**: Gerencie solicitações de acesso de funcionários.
- **Autenticação**: Login e registro de usuários.
- **Permissões de Localização**: Solicitação de permissões de localização em primeiro e segundo plano.

## Instalação

1. Clone o repositório:
    ```sh
    git clone https://github.com/seu-usuario/rastreamento-facil.git
    cd rastreamento-facil
    ```

2. Instale as dependências:
    ```sh
    npm install
    ```

3. Crie um arquivo `.env` baseado no `.env.example`:
    ```sh
    cp .env.example .env
    ```

4. Configure as variáveis de ambiente no arquivo `.env`.

## Scripts Disponíveis

No diretório do projeto, você pode executar:

### `npx expo start`

Inicia o aplicativo no modo de desenvolvimento.
Um QR code será gerado e você pode escaneá-lo com o aplicativo Expo Go para visualizar o aplicativo no seu dispositivo.

### `npm run android`

Inicia o aplicativo no modo de desenvolvimento em um dispositivo Android ou emulador.

### `npm run ios`

Inicia o aplicativo no modo de desenvolvimento em um dispositivo iOS ou simulador.

## Estrutura de Arquivos

### App.tsx

O ponto de entrada principal do aplicativo. Gerencia o estado de login e navegação entre as telas.

### `src/screens/`

Contém as telas principais do aplicativo:
- [LoginScreen.tsx](src/screens/LoginScreen.tsx): Tela de login.
- [RegisterScreen.tsx](src/screens/RegisterScreen.tsx): Tela de registro.
- [HallScreen.tsx](src/screens/HallScreen.tsx): Tela principal que exibe as empresas vinculadas e solicitações de acesso.
- [MapScreen.tsx](src/screens/MapScreen.tsx): Tela de mapa que exibe a localização atual do usuário.


### `src/tasks/LocationTask.ts`

Define e gerencia a tarefa de rastreamento de localização em segundo plano usando `expo-task-manager` e `expo-location`.

### `src/utils/auth.ts`

Contém funções utilitárias para autenticação, como obter, validar e remover tokens.

### `src/loadFonts.ts`

Carrega as fontes personalizadas usadas no aplicativo.

## Configuração do Babel

O arquivo [babel.config.js](babel.config.js) configura o Babel para usar o plugin `react-native-dotenv` para carregar variáveis de ambiente.

## Configuração do TypeScript

O arquivo [tsconfig.json](tsconfig.json) estende a configuração base do Expo e define caminhos personalizados para módulos.

## Outras Partes do Projeto

- **API**: [APIRastreioFacil](https://github.com/Luizoka/APIRastreioFacil)
- **Web**: [WebRastreioFacil](https://github.com/Luizoka/WebRastreioFacil)

Certifique-se de seguir as instruções de instalação e configuração nos respectivos repositórios para rodar a API e a aplicação web.