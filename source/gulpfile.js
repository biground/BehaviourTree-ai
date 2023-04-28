'use strict';
const gulp = require('gulp');
const { series } = require('gulp');
const minify = require('gulp-minify');
const inject = require('gulp-inject-string');
const ts = require('gulp-typescript');
const merge = require('merge2');
const tsProject = ts.createProject('tsconfig.json');

function buildJs() {
    return tsProject
        .src()
        .pipe(tsProject())
        .js.pipe(inject.replace('var behaviourTree;', ''))
        .pipe(inject.replace('var fsm;', ''))
        .pipe(inject.replace('var utilityAI;', ''))
        .pipe(
            inject.prepend(
                'window.fsm = {}; window.behaviourTree = {}; window.utilityAI = {};\n',
            ),
        )
        .pipe(inject.replace('var __extends =', 'window.__extends ='))
        .pipe(minify({ ext: { min: '.min.js' } }))
        .pipe(gulp.dest('./bin'));
}

function buildDts() {
    return tsProject.src().pipe(tsProject()).pipe(gulp.dest('./bin'));
}

function copy() {
    return merge([
        gulp
            .src('bin/ai.min.js')
            .pipe(gulp.dest('../../SnakeSurvivor/bin/libs/min/')),
        gulp
            .src('bin/ai.js')
            .pipe(gulp.dest('../../SnakeSurvivor/bin/libs/')),
        gulp.src('bin/*.ts').pipe(gulp.dest('../../SnakeSurvivor/libs/')),
    ]);
}

exports.build = series(buildJs, buildDts, copy);

