export default [
    {
        ignores: ["node_modules/**", "coverage/**"]
    },
    {
        files: ["**/*.js"],
        languageOptions: {
            ecmaVersion: "latest",
            sourceType: "commonjs",
            globals: {
                require: "readonly",
                module: "readonly",
                process: "readonly",
                console: "readonly",
                __dirname: "readonly",
                jest: "readonly",
                test: "readonly",
                expect: "readonly",
                afterAll: "readonly"
            }
        },
        rules: {
            "no-unused-vars": "warn",
            "no-undef": "error",
            eqeqeq: "error",
            semi: ["error", "always"]
        }
    },
    {
        files: ["db/migrations/**/*.js"],
        languageOptions: {
            sourceType: "module"
        }
    }
];