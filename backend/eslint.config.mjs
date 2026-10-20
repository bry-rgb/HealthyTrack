
export default [
    {
        files: ["**/*.js"],
        ignores: ["node_modules/**", "coverage/**"],
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
            "eqeqeq": "error",
            "semi": ["error", "always"]
        }
    }
];
